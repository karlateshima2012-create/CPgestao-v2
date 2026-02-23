<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Device;
use App\Models\PointMovement;
use App\Models\Tenant;
use App\Models\PointRequest;
use App\Models\TenantSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use App\Services\PointRequestService;
use Exception;

use App\Http\Responses\ApiResponse;
use App\Utils\PhoneHelper;
use App\Utils\Luhn;
use App\Services\TelegramService;
use Carbon\Carbon;

class PublicTerminalController extends Controller
{
    protected $telegramService;
    protected $pointRequestService;
    protected $planService;
    protected $qrTokenService;
    protected $deviceService;

    public function __construct(
        TelegramService $telegramService, 
        PointRequestService $pointRequestService,
        \App\Services\PlanService $planService,
        \App\Services\QrTokenService $qrTokenService,
        \App\Services\DeviceService $deviceService
    ) {
        $this->telegramService = $telegramService;
        $this->pointRequestService = $pointRequestService;
        $this->planService = $planService;
        $this->qrTokenService = $qrTokenService;
        $this->deviceService = $deviceService;
    }
    /**
     * Centralized device validation.
     * Supports physical terminals, loyalty cards, and online virtual devices.
     */
    private function validateDevice($slug, $uid = null, $token = null)
    {
        $tenant = Tenant::where('slug', $slug)->first();
        if (!$tenant) {
            abort(404);
        }

        if ($tenant->status !== 'active') {
            $msg = $tenant->status === 'blocked' 
                ? 'Esta página está temporariamente indisponível.' 
                : 'Esta loja está temporariamente inativa.';
            abort(403, $msg);
        }

        if ($tenant->plan_expires_at && \Carbon\Carbon::parse($tenant->plan_expires_at)->isPast()) {
            abort(403, 'Não é possível se conectar a esta página no momento');
        }

        if (request()->isMethod('GET')) {
            $tenant->increment('public_page_visits');
        }

        // Online Flow with token
        if ($token) {
            $this->qrTokenService->isValid($token, $tenant->id); // Throws if invalid
            $device = $this->deviceService->getOrCreateOnlineQrDevice($tenant->id);
            return [$tenant, $device];
        }

        if (!$uid || $uid === 'null') {
            return [$tenant, null];
        }

        // New Device structure: uid is now nfc_uid
        $device = Device::where('nfc_uid', $uid)
            ->where('tenant_id', $tenant->id)
            ->first();

        if (!$device) {
            abort(404);
        }

        if (!$device->active) {
            abort(403, 'Dispositivo inativo');
        }

        return [$tenant, $device];
    }

    /**
     * Create a point request record and dispatch event.
     */
    private function createPointRequest(array $data)
    {
        $request = PointRequest::create([
            'tenant_id' => $data['tenant_id'],
            'customer_id' => $data['customer_id'] ?? null,
            'phone' => $data['phone'],
            'device_id' => $data['device_id'] ?? null,
            'source' => $data['source'] ?? 'approval',
            'status' => $data['status'] ?? 'pending',
            'requested_points' => $data['requested_points'] ?? 1,
            'meta' => $data['meta'] ?? null,
        ]);

        // Dispatch real-time event
        event(new \App\Events\PointRequestCreated($request));

        return $request;
    }

    public function getInfo(Request $request, $slug, $uid = null)
    {
        $token = $request->query('token');
        [$tenant, $device] = $this->validateDevice($slug, $uid, $token);

        // Check if token is valid (re-verify for the response)
        $tokenValid = $token ? $this->qrTokenService->isValid($token, $tenant->id) : false;

        return ApiResponse::ok([
            'name' => $tenant->name,
            'slug' => $tenant->slug,
            'description' => $tenant->description,
            'logo_url' => $tenant->logo_url,
            'cover_url' => $tenant->cover_url,
            'rules_text' => $tenant->rules_text,
            'points_goal' => $tenant->points_goal,
            'reward_text' => $tenant->reward_text,
            'device_name' => $device ? $device->name : 'Navegador Web',
            'device_mode' => $device ? $device->mode : 'standard',
            'token_valid' => $tokenValid,
            'tenant_name' => $tenant->name,
            'levels_config' => $tenant->loyaltySettings ? $tenant->loyaltySettings->levels_config : null,
        ]);
    }

    public function getStoreInfo(Request $request, $slug)
    {
        return $this->getInfo($request, $slug, null);
    }

    public function lookup(Request $request, $slug, $uid = null)
    {
        $request->validate([
            'phone' => 'required|string',
            'token' => 'nullable|string'
        ]);

        [$tenant, $device] = $this->validateDevice($slug, $uid, $request->token);
        
        $phone = PhoneHelper::normalize($request->phone);
        $customer = Customer::where('tenant_id', $tenant->id)
            ->where('phone', $phone)
            ->first();

        if (!$customer) {
            return ApiResponse::ok([
                'customer_exists' => false,
                'points_balance' => 0
            ]);
        }

        $balance = $customer->points_balance;
        $levelsConfig = $tenant->loyaltySettings ? $tenant->loyaltySettings->levels_config : null;
        $currentLevel = $customer->loyalty_level ?? 0;
        
        $goal = $tenant->points_goal;
        if (is_array($levelsConfig) && isset($levelsConfig[$currentLevel])) {
            $goal = (int)($levelsConfig[$currentLevel]['goal'] ?? $goal);
        }
        $remaining = max(0, $goal - $balance);

        // Get recent history
        $history = PointMovement::where('customer_id', $customer->id)
            ->where('tenant_id', $tenant->id)
            ->latest()
            ->limit(10)
            ->get()
            ->map(function ($m) {
                return [
                    'amount' => $m->points,
                    'type' => $m->type, // earn/spend
                    'date' => $m->created_at->format('d/m/Y H:i'),
                    'description' => $m->meta['description'] ?? ($m->type === 'earn' ? 'Pontuação' : 'Resgate')
                ];
            });

        return ApiResponse::ok([
            'customer_exists' => true,
            'id' => $customer->id,
            'name' => $customer->name,
            'points_balance' => $balance,
            'points_goal' => $goal,
            'remaining' => $remaining,
            'history' => $history,
            'is_premium' => $customer->is_premium,
            'loyalty_level' => $customer->loyalty_level
        ]);
    }

    public function validatePin(Request $request, $slug, $uid)
    {
        // No longer using PIN for validation
        return ApiResponse::ok(null, 'PIN validado com sucesso');
    }

    public function earn(Request $request, $slug, $uid)
    {
        $request->validate([
            'phone' => 'required|string',
            'pin' => 'nullable|string',
            'token' => 'nullable|string'
        ]);

        return DB::transaction(function () use ($request, $slug, $uid) {
            $token = $request->token;
            [$tenant, $device] = $this->validateDevice($slug, $uid, $token);

            $phone = PhoneHelper::normalize($request->phone);

            $customer = Customer::where('tenant_id', $tenant->id)
                ->where('phone', $phone)
                ->first();

            $isNew = false;
            if (!$customer) {
                $isNew = true;
                $customer = Customer::create([
                    'tenant_id' => $tenant->id,
                    'phone' => $phone,
                    'name' => 'Cliente',
                    'source' => 'terminal',
                    'last_activity_at' => now()
                ]);

                $this->telegramService->sendMessage($tenant->id, "🆕 <b>Novo Cliente (Pontuação Balcão)</b>\n\n<b>Telefone:</b> {$customer->phone}");
            }

            // Consumption of token if present
            if ($token) {
                $this->qrTokenService->consumeToken($token, $tenant->id);
            }

            // AUTO-CHECKIN PROTECTION: Interval check
            if ($device && $device->mode === 'auto_checkin') {
                $minInterval = $this->planService->getMinCheckinInterval($tenant);
                if ($minInterval > 0) {
                    $lastCheckin = PointMovement::where('customer_id', $customer->id)
                        ->where('tenant_id', $tenant->id)
                        ->where('origin', 'auto_checkin')
                        ->where('created_at', '>', now()->subMinutes($minInterval))
                        ->latest()
                        ->first();

                    if ($lastCheckin) {
                        return ApiResponse::error('Check-in já realizado hoje!', 'CHECKIN_COOLDOWN', 429);
                    }
                }
            }

            $loyalty = $tenant->loyaltySettings ?: \App\Models\LoyaltySetting::create(['tenant_id' => $tenant->id]);

            // ANTI-FRAUDE: Cooldown padrão do sistema (60s) - Bypassed for tokens as they are single-use
            if (!$token) {
                $cooldown = 60;
                $lastMovement = PointMovement::where('customer_id', $customer->id)
                    ->where('tenant_id', $tenant->id)
                    ->where('type', 'earn')
                    ->where('created_at', '>', now()->subSeconds($cooldown))
                    ->first();

                if ($lastMovement) {
                    return ApiResponse::error('Aguarde um momento para pontuar novamente', 'COOLDOWN', 429);
                }
            }

            // Grant signup bonus if new
            if ($isNew && $loyalty->signup_bonus_points > 0) {
                $bonus = $loyalty->signup_bonus_points;
                $bonusRequest = $this->createPointRequest([
                    'tenant_id' => $tenant->id,
                    'customer_id' => $customer->id,
                    'phone' => $customer->phone,
                    'device_id' => $device ? $device->id : null,
                    'source' => 'online_qr', 
                    'status' => 'pending',
                    'requested_points' => $bonus,
                    'meta' => ['is_signup_bonus' => true]
                ]);
                
                $this->pointRequestService->applyPoints($bonusRequest);
                $bonusRequest->update(['status' => 'auto_approved', 'approved_at' => now()]);
            }

            $pointsToAdd = $customer->is_premium 
                ? ($loyalty->vip_points_per_scan ?? 2) 
                : ($loyalty->regular_points_per_scan ?? 1); 

            $levelsConfig = $loyalty->levels_config;
            $currentLevel = $customer ? ($customer->loyalty_level ?? 0) : 0;
            
            if (is_array($levelsConfig) && isset($levelsConfig[$currentLevel]) && isset($levelsConfig[$currentLevel]['points_per_visit'])) {
                $pointsToAdd = (int) $levelsConfig[$currentLevel]['points_per_visit'];
            }

            // Create Point Request
            $requestRecord = $this->createPointRequest([
                'tenant_id' => $tenant->id,
                'customer_id' => $customer->id,
                'phone' => $customer->phone,
                'device_id' => $device ? $device->id : null,
                'source' => $device ? $device->mode : 'approval',
                'status' => 'pending',
                'requested_points' => $pointsToAdd,
                'meta' => $token ? ['qr_token' => $token] : null,
            ]);

            // Flow 3: AUTO-APPROVE Logic
            $canAutoApprove = ($device && $device->auto_approve && $this->planService->canAutoApprove($tenant)); 
            
            if ($canAutoApprove) {
                $this->pointRequestService->applyPoints($requestRecord);
                $requestRecord->update(['status' => 'auto_approved', 'approved_at' => now()]);
            } elseif ($device && $device->telegram_chat_id && $requestRecord->status === 'pending') {
                // Not auto-approved: Send Telegram notification to the responsible party
                $message = "🔹 *Novo Pedido de Ponto*\n\n"
                         . "👤 *Cliente:* {$customer->name}\n"
                         . "📱 *Telefone:* {$customer->phone}\n"
                         . "🎁 *Pontos:* +{$pointsToAdd}\n"
                         . "📍 *Totem:* {$device->name}\n\n"
                         . "Acesse o painel para Aprovar ou Recusar.";
                         
                $settings = TenantSetting::where('tenant_id', $tenant->id)->first();
                $disableSound = $settings ? !$settings->telegram_sound_points : false;
                
                $this->telegramService->sendDirectMessage($device->telegram_chat_id, $message, $disableSound);
            }

            $customer->update(['last_activity_at' => now()]);

            $newBalance = $customer->fresh()->points_balance;
            $goal = $tenant->points_goal;
            if (is_array($levelsConfig) && isset($levelsConfig[$currentLevel])) {
                $goal = (int)($levelsConfig[$currentLevel]['goal'] ?? $goal);
            }

            $msg = "✅ +{$pointsToAdd} ponto(s) adicionado(s). Saldo: {$newBalance} / Meta: {$goal}.";
            
            if ($newBalance >= $goal) {
                $msg .= " 🎉 Meta atingida! Pronto para resgatar.";
            }

            return ApiResponse::ok([
                'points_earned' => $pointsToAdd, 
                'new_balance' => $newBalance,
                'message' => $msg,
                'auto_approved' => $canAutoApprove
            ]);
        });
    }

    public function redeem(Request $request, $slug, $uid)
    {
        $request->validate([
            'phone' => 'required|string',
            'pin' => 'required|string'
        ]);

        return DB::transaction(function () use ($request, $slug, $uid) {
            [$tenant, $device] = $this->validateDevice($slug, $uid);

            $phone = PhoneHelper::normalize($request->phone);
            $customer = Customer::where('tenant_id', $tenant->id)->where('phone', $phone)->first();

            $loyalty = $tenant->loyaltySettings ?: \App\Models\LoyaltySetting::create(['tenant_id' => $tenant->id]);
            $levelsConfig = $loyalty->levels_config;
            $currentLevel = $customer ? ($customer->loyalty_level ?? 0) : 0;
            
            $goal = $tenant->points_goal;
            $levelName = "Nível VIP";
            
            if (is_array($levelsConfig) && isset($levelsConfig[$currentLevel])) {
                $goal = (int)($levelsConfig[$currentLevel]['goal'] ?? $goal);
                $levelName = $levelsConfig[$currentLevel]['name'] ?? $levelName;
            }

            if (!$customer || $customer->points_balance < $goal) {
                return ApiResponse::error("Saldo insuficiente para resgate no nível {$levelName} (meta: {$goal})", 'INSUFFICIENT_POINTS', 409);
            }

            $pointsToAdd = $customer->is_premium 
                ? ($loyalty->vip_points_per_scan ?? 2) 
                : ($loyalty->regular_points_per_scan ?? 1);

            $bonus = $loyalty->redeem_bonus_points ?? 0;
            $vipInitial = $loyalty->vip_initial_points ?? 0;
            
            $wasPremium = $customer->is_premium;

            // Create Point Request (Redeem)
            $requestRecord = $this->createPointRequest([
                'tenant_id' => $tenant->id,
                'customer_id' => $customer->id,
                'phone' => $customer->phone,
                'device_id' => $device ? $device->id : null,
                'source' => $device ? ($device->mode === 'auto_checkin' ? 'auto_checkin' : 'approval') : 'approval',
                'status' => 'pending',
                'requested_points' => $pointsToAdd + $bonus,
                'meta' => [
                    'is_redemption' => true,
                    'goal' => $goal,
                    'bonus' => $bonus,
                    'vip_initial' => $vipInitial,
                    'became_premium' => !$wasPremium
                ]
            ]);

            // Redemptions usually require manual approval except in Elite auto_checkin mode?
            // Actually, redemptions are "prizes", so manual approval is often preferred.
            // But if auto_approve is on, follow it.
            $canAutoApprove = ($device && $device->auto_approve && $this->planService->canAutoApprove($tenant));

            if ($canAutoApprove) {
                $this->pointRequestService->applyPoints($requestRecord);
                $requestRecord->update(['status' => 'auto_approved', 'approved_at' => now()]);
            } elseif ($device && $device->telegram_chat_id && $requestRecord->status === 'pending') {
                $message = "👑 *Novo Pedido de Resgate VIP*\n\n"
                         . "👤 *Cliente:* {$customer->name}\n"
                         . "📱 *Telefone:* {$customer->phone}\n"
                         . "📍 *Totem:* {$device->name}\n\n"
                         . "Acesse o painel para verificar o prêmio e Aprovar o resgate.";
                         
                $settings = TenantSetting::where('tenant_id', $tenant->id)->first();
                $disableSound = $settings ? !$settings->telegram_sound_points : false;
                
                $this->telegramService->sendDirectMessage($device->telegram_chat_id, $message, $disableSound);
            }

            $customer->update(['last_activity_at' => now()]);
            $newBalance = $customer->fresh()->points_balance;

            return ApiResponse::ok([
                'new_balance' => $newBalance,
                'message' => 'Solicitação de resgate enviada com sucesso.',
                'auto_approved' => $canAutoApprove
            ]);
        });
    }
    public function register(Request $request, $slug, $uid = null)
    {
        $request->validate([
            'name' => 'required|string|max:100',
            'phone' => 'required|string',
            'email' => 'nullable|email|max:100',
            'city' => 'nullable|string|max:100',
            'province' => 'nullable|string|max:100',
        ]);

        return DB::transaction(function () use ($request, $slug, $uid) {
            [$tenant, $device] = $this->validateDevice($slug, $uid);

            $phone = PhoneHelper::normalize($request->phone);

            // Check for existing
            if (Customer::where('tenant_id', $tenant->id)->where('phone', $phone)->exists()) {
                return ApiResponse::error('Este número de telefone já está cadastrado nesta loja. Para visualizar os pontos, utilize a opção Consultar saldo.', 'DUPLICATE_PHONE', 409);
            }

            $customer = Customer::create([
                'tenant_id' => $tenant->id,
                'name' => $request->name,
                'phone' => $phone,
                'email' => $request->email,
                'city' => $request->city,
                'province' => $request->province,
                'source' => 'terminal',
                'last_activity_at' => now()
            ]);

            $this->telegramService->sendMessage($tenant->id, "✨ <b>Novo Cliente Cadastrado (Totem)</b>\n\n<b>Nome:</b> {$customer->name}\n<b>Telefone:</b> {$customer->phone}");

            $loyalty = $tenant->loyaltySettings ?: \App\Models\LoyaltySetting::create(['tenant_id' => $tenant->id]);
            
            $bonusMessage = "";
            if ($loyalty->signup_bonus_points > 0) {
                $bonus = $loyalty->signup_bonus_points;

                // Create Point Request (New Layer)
                $requestRecord = $this->createPointRequest([
                    'tenant_id' => $tenant->id,
                    'customer_id' => $customer->id,
                    'phone' => $customer->phone,
                    'device_id' => $device ? $device->id : null,
                    'source' => 'online_qr',
                    'status' => 'pending',
                    'requested_points' => $bonus,
                    'meta' => ['is_signup_bonus' => true]
                ]);

                // Bonus is usually auto-approved
                $this->pointRequestService->applyPoints($requestRecord);
                $requestRecord->update(['status' => 'auto_approved', 'approved_at' => now()]);

                $bonusMessage = " (Bônus de boas-vindas aplicado!)";
            }

            return ApiResponse::ok([
                'customer_exists' => true,
                'points_balance' => $customer->fresh()->points_balance,
                'is_premium' => false
            ], "✅ Cadastro realizado com sucesso!{$bonusMessage}");
        });
    }

    public function linkVip(Request $request, $slug, $uid)
    {
        $request->validate([
            'phone' => 'required|string',
            'target_uid' => 'required|string',
            'pin' => 'required|string'
        ]);

        return DB::transaction(function () use ($request, $slug, $uid) {
            [$tenant, $device] = $this->validateDevice($slug, $uid);

            $phone = PhoneHelper::normalize($request->phone);
            $customer = Customer::where('tenant_id', $tenant->id)->where('phone', $phone)->firstOrFail();

            if ($customer->is_premium) {
                return ApiResponse::error('Este cliente já possui um cartão VIP vinculado.', 'ALREADY_PREMIUM', 400);
            }

            $targetUidRaw = preg_replace('/\D/', '', $request->target_uid);
            
            if (strlen($targetUidRaw) !== 12) {
                return ApiResponse::error('O número do cartão deve ter exatamente 12 dígitos.', 'INVALID_LENGTH', 400);
            }
            
            // Resolve target card (LoyaltyCard)
            $targetCard = \App\Models\LoyaltyCard::where('tenant_id', $tenant->id)
                ->where('uid', $targetUidRaw)
                ->where('type', 'premium')
                ->first();

            if (!$targetCard) {
                return ApiResponse::error('Cartão VIP não encontrado ou inválido.', 'VIP_NOT_FOUND', 404);
            }

            if ($targetCard->linked_customer_id) {
                return ApiResponse::error('Este cartão já está vinculado a outro cliente.', 'ALREADY_LINKED', 409);
            }

            $targetCard->update([
                'linked_customer_id' => $customer->id,
                'status' => 'linked',
                'active' => true
            ]);

            $customer->update(['is_premium' => true]);

            return ApiResponse::ok(null, 'Cartão VIP vinculado com sucesso');
        });
    }
}
