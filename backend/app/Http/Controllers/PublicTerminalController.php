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

        // Luhn validation removed as UIDs can be alphanumeric for totems/devices

        // New Device structure: uid is now nfc_uid
        $device = Device::withoutGlobalScopes()->where('nfc_uid', $uid)
            ->where('tenant_id', $tenant->id)
            ->first();

        if (!$device) {
            // Check if it's a Loyalty Card (NFC Card) being scanned as a terminal
            $card = \App\Models\LoyaltyCard::withoutGlobalScopes()
                ->where('uid', $uid)
                ->where('tenant_id', $tenant->id)
                ->first();

            if ($card) {
                // Create a virtual device object to satisfy the response
                $device = new Device([
                    'tenant_id' => $tenant->id,
                    'name' => 'Cartão VIP (Leitura Direta)',
                    'mode' => 'standard',
                    'active' => true,
                    'nfc_uid' => $uid
                ]);
            } else {
                abort(404, 'Dispositivo ou Cartão não reconhecido.');
            }
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
            'tenant_plan' => $tenant->plan,
            'is_limit_reached' => $tenant->isLimitReached(),
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
            'loyalty_level' => $customer->loyalty_level,
            'loyalty_level_name' => $customer->loyalty_level_name
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
            'token' => 'nullable|string',
            'name' => 'sometimes|string',
            'city' => 'sometimes|string',
            'province' => 'sometimes|string',
            'address' => 'sometimes|string',
            'email' => 'sometimes|email|nullable',
            'birthday' => 'sometimes|date|nullable'
        ]);

        return DB::transaction(function () use ($request, $slug, $uid) {
            $token = $request->token;
            [$tenant, $device] = $this->validateDevice($slug, $uid, $token);
            
            // CLASSIC PLAN PROTECTION: Passive totem
            // Removed plan-based blockade to unify logic across Classic, Pro, and Elite

            $phone = PhoneHelper::normalize($request->phone);

            $customer = Customer::where('tenant_id', $tenant->id)
                ->where('phone', $phone)
                ->first();

            $isNew = false;
            if (!$customer) {
                if ($tenant->isLimitReached()) {
                    $this->telegramService->sendMessage($tenant->id, "🚫 *Limite Atingido\!* O cadastro de novos clientes foi pausado\.");
                    return ApiResponse::error('Limite de clientes atingido para esta loja.', 'PLAN_LIMIT_REACHED', 403);
                }
                $isNew = true;
                $customer = Customer::create([
                    'tenant_id' => $tenant->id,
                    'phone' => $phone,
                    'name' => $request->name ?? 'Cliente',
                    'city' => $request->city,
                    'province' => $request->province,
                    'address' => $request->address,
                    'email' => $request->email,
                    'birthday' => $request->birthday,
                    'source' => 'terminal',
                    'last_activity_at' => now()
                ]);

                $tenant->verifyAndNotifyLimit();

                $escPhone = TelegramService::escapeMarkdownV2($customer->phone);
                $newMessage = "🆕 *Novo Cliente \(Pontuação Balcão\)*\n\n"
                            . "📞 *Telefone:* {$escPhone}";
                
                if ($device && $device->telegram_chat_id) {
                    $this->telegramService->sendDirectMessage($device->telegram_chat_id, $newMessage);
                } else {
                    $this->telegramService->sendMessage($tenant->id, $newMessage);
                }
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

            if (is_array($levelsConfig)) {
                $lvlIdx = max(0, $currentLevel - 1);
                if (isset($levelsConfig[$lvlIdx]) && isset($levelsConfig[$lvlIdx]['points_per_visit'])) {
                    $pointsToAdd = (int) $levelsConfig[$lvlIdx]['points_per_visit'];
                }
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

            // Flow 3: PLAN-BASED APPROVAL LOCK (Locked per requirement)
            $isElite = (strtolower($tenant->plan) === 'elite');
            $isPro = (strtolower($tenant->plan) === 'pro');
            $isClassic = (strtolower($tenant->plan) === 'classic');
            
            $canAutoApprove = false;
            if ($isElite) {
                // Elite: 100% automatic (Requirement: "pontuação continua sendo automática")
                $canAutoApprove = true;
            } elseif ($isPro) {
                // Pro: Mandatory Telegram approval (Requirement: "solicita aprovação via Telegram")
                $canAutoApprove = false;
            } elseif ($isClassic) {
                // Classic: Approval via the loyalty card (Requirement: "se dá por meio do cartão de ponto")
                // Scanning a card generates a token; manual phone entry does not.
                $canAutoApprove = !empty($token);
            } else {
                // Follow device settings for other plans/trials
                $canAutoApprove = ($device && $device->auto_approve && $this->planService->canAutoApprove($tenant));
            }

            if ($canAutoApprove) {
                $this->pointRequestService->applyPoints($requestRecord);
                $requestRecord->update(['status' => 'auto_approved', 'approved_at' => now()]);
                
                event(new \App\Events\PointRequestStatusUpdated($requestRecord));
            } elseif ($requestRecord->status === 'pending' && ($tenant->plan === 'Pro' || $tenant->plan === 'pro')) {
                $settings = \App\Models\TenantSetting::where('tenant_id', $tenant->id)->first();
                $targetChatId = ($device && $device->telegram_chat_id) ? $device->telegram_chat_id : ($settings ? $settings->telegram_chat_id : null);

                if ($targetChatId) {
                    // Not auto-approved: Send Telegram notification with interactive buttons
                    $locationName = $device ? ($device->responsible_name ?: $device->name) : 'Terminal Público';
                    
                    $escName = TelegramService::escapeMarkdownV2($customer->name);
                    $escLoc = TelegramService::escapeMarkdownV2($locationName);
                    
                    $message = "🔔 *Solicitação no Totem\!*\n\n"
                             . "O cliente *{$escName}* solicitou um ponto no *{$escLoc}*\. Aprovar?";
                    
                    $replyMarkup = [
                        'inline_keyboard' => [
                            [
                                ['text' => '✅ APROVAR', 'callback_data' => "approve_request:{$requestRecord->id}"],
                                ['text' => '❌ RECUSAR', 'callback_data' => "reject_request:{$requestRecord->id}"]
                            ]
                        ]
                    ];
                    
                    $disableSound = $settings ? !$settings->telegram_sound_points : false;
                    $this->telegramService->sendDirectMessage($targetChatId, $message, $disableSound, $replyMarkup);
                }
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
                'request_id' => $requestRecord->id,
                'customer_name' => $customer->name,
                'points_earned' => $pointsToAdd, 
                'new_balance' => $newBalance,
                'loyalty_level_name' => $customer->loyalty_level_name,
                'points_goal' => $goal,
                'message' => $msg,
                'auto_approved' => $canAutoApprove
            ]);
        });
    }

    public function redeem(Request $request, $slug, $uid)
    {
        $request->validate([
            'phone' => 'required|string',
            'pin' => 'nullable|string',
            'token' => 'nullable|string'
        ]);

        return DB::transaction(function () use ($request, $slug, $uid) {
            [$tenant, $device] = $this->validateDevice($slug, $uid);

            // Removed plan-based blockade to unify logic across Classic, Pro, and Elite


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

            // Important: As we are redeeming and moving to the next level, the visit point
            // should follow the configuration of that next level.
            $nextLevelIdx = $currentLevel; // If currentLevel is Bronze (1), index 1 is Silver.
            if (is_array($levelsConfig) && isset($levelsConfig[$nextLevelIdx]) && isset($levelsConfig[$nextLevelIdx]['points_per_visit'])) {
                $pointsToAdd = (int) $levelsConfig[$nextLevelIdx]['points_per_visit'];
            }

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

            // Flow 3: PLAN-BASED APPROVAL LOCK (Locked per requirement)
            $isElite = (strtolower($tenant->plan) === 'elite');
            $isPro = (strtolower($tenant->plan) === 'pro');
            $isClassic = (strtolower($tenant->plan) === 'classic');
            
            $canAutoApprove = false;
            if ($isElite) {
                $canAutoApprove = true;
            } elseif ($isPro) {
                $canAutoApprove = false;
            } elseif ($isClassic) {
                $canAutoApprove = !empty($request->token);
            } else {
                $canAutoApprove = ($device && $device->auto_approve && $this->planService->canAutoApprove($tenant));
            }

            if ($canAutoApprove) {
                $this->pointRequestService->applyPoints($requestRecord);
                $requestRecord->update(['status' => 'auto_approved', 'approved_at' => now()]);
            } elseif ($device && $device->telegram_chat_id && $requestRecord->status === 'pending' && ($tenant->plan === 'Pro' || $tenant->plan === 'pro')) {
                $levelName = $customer->loyalty_level_name;
                $locationName = $device->responsible_name ?: $device->name;
                $message = "👑 <b>Pedido de Resgate VIP - {$tenant->name}</b>\n"
                         . "📍 <b>Local:</b> {$locationName}\n"
                         . "👤 <b>Cliente:</b> {$customer->name} ({$customer->phone})\n"
                         . "📈 <b>Nível Atual:</b> {$levelName}\n\n"
                         . "Deseja aprovar o resgate de prêmio para este cliente?";
                
                $replyMarkup = [
                    'inline_keyboard' => [
                        [
                            ['text' => '✅ APROVAR', 'callback_data' => "approve_request:{$requestRecord->id}"],
                            ['text' => '❌ RECUSAR', 'callback_data' => "reject_request:{$requestRecord->id}"]
                        ]
                    ]
                ];
                         
                $settings = TenantSetting::where('tenant_id', $tenant->id)->first();
                $disableSound = $settings ? !$settings->telegram_sound_points : false;
                
                $this->telegramService->sendDirectMessage($device->telegram_chat_id, $message, $disableSound, $replyMarkup);
            }

            $customer->update(['last_activity_at' => now()]);
            $newBalance = $customer->fresh()->points_balance;

            $goal = $tenant->points_goal;
            $currentLevel = $customer->loyalty_level ?? 0;
            if (is_array($levelsConfig) && isset($levelsConfig[$currentLevel])) {
                $goal = (int)($levelsConfig[$currentLevel]['goal'] ?? $goal);
            }

            return ApiResponse::ok([
                'request_id' => $requestRecord->id,
                'customer_name' => $customer->name,
                'new_balance' => $newBalance,
                'loyalty_level_name' => $customer->loyalty_level_name,
                'points_goal' => $goal,
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
            'city' => 'required|string|max:100',
            'province' => 'required|string|max:100',
            'postal_code' => 'nullable|string|max:20',
            'address' => 'nullable|string|max:255',
            'birthday' => 'nullable|date',
        ]);

        try {
            return DB::transaction(function () use ($request, $slug, $uid) {
                [$tenant, $device] = $this->validateDevice($slug, $uid);

                $phone = PhoneHelper::normalize($request->phone);

                // Check for existing
                if (Customer::where('tenant_id', $tenant->id)->where('phone', $phone)->exists()) {
                    return ApiResponse::error('Este número de telefone já está cadastrado nesta loja. Para visualizar os pontos, utilize a opção Consultar saldo.', 'DUPLICATE_PHONE', 409);
                }

                // Limit Check
                if ($tenant->isLimitReached()) {
                    $this->telegramService->sendMessage($tenant->id, "🚫 *Limite Atingido\!* O cadastro de novos clientes foi pausado\.");
                    return ApiResponse::error('Limite de clientes atingido para esta loja.', 'PLAN_LIMIT_REACHED', 403);
                }

                $birthday = $request->birthday ?: null;
                if ($birthday === '') $birthday = null;

                $customer = Customer::create([
                    'tenant_id' => $tenant->id,
                    'name' => $request->name,
                    'phone' => $phone,
                    'email' => $request->email ?: null,
                    'city' => $request->city ?: null,
                    'province' => $request->province ?: null,
                    'postal_code' => $request->postal_code ?: null,
                    'address' => $request->address ?: null,
                    'birthday' => $birthday,
                    'source' => 'terminal',
                    'last_activity_at' => now()
                ]);

                $tenant->verifyAndNotifyLimit();

                $escName = TelegramService::escapeMarkdownV2($customer->name);
                $escPhone = TelegramService::escapeMarkdownV2($customer->phone);
                $regMessage = "✨ *Novo Cliente Cadastrado \(Totem\)*\n\n"
                            . "👤 *Nome:* {$escName}\n"
                            . "📞 *Telefone:* {$escPhone}";

                try {
                    if ($device && $device->telegram_chat_id) {
                        $this->telegramService->sendDirectMessage($device->telegram_chat_id, $regMessage);
                    } else {
                        $this->telegramService->sendMessage($tenant->id, $regMessage);
                    }
                } catch (\Exception $te) {
                    \Illuminate\Support\Facades\Log::warning("Registration Telegram alert failed: " . $te->getMessage());
                }

                $loyalty = $tenant->loyaltySettings ?: \App\Models\LoyaltySetting::create(['tenant_id' => $tenant->id]);
                
                $bonus = 0;
                $levels = $loyalty->levels_config;
                if (is_array($levels) && count($levels) > 0 && isset($levels[0]['points_per_signup'])) {
                    $bonus = (int)$levels[0]['points_per_signup'];
                } else {
                    $bonus = (int)($loyalty->signup_bonus_points ?? 0);
                }

                $bonusMessage = "";
                if ($bonus > 0) {
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

                    $bonusMessage = " (Bônus de boas-vindas: {$bonus} pts)";
                }

                // --- NEW INTEGRATED FLOW: Link Card & Award Visit Points ---
                
                // 1. Link Card if UID is a premium card
                $linkMessage = "";
                if ($uid) {
                    $card = \App\Models\LoyaltyCard::where('tenant_id', $tenant->id)
                        ->where('uid', $uid)
                        ->where('type', 'premium')
                        ->first();
                    
                    if ($card && !$card->linked_customer_id) {
                        $card->update([
                            'linked_customer_id' => $customer->id,
                            'status' => 'linked',
                            'active' => true
                        ]);
                        $customer->update(['is_premium' => true]);
                        $linkMessage = " + Cartão Vinculado";
                    }
                }

                // 2. Award Visit Points
                $visitPts = 0;
                if (is_array($levels) && count($levels) > 0 && isset($levels[0]['points_per_visit'])) {
                    $visitPts = (int)$levels[0]['points_per_visit'];
                } else {
                    $visitPts = (int)($loyalty->regular_points_per_scan ?? 1);
                }

                if ($visitPts > 0) {
                    $visitRequest = $this->createPointRequest([
                        'tenant_id' => $tenant->id,
                        'customer_id' => $customer->id,
                        'phone' => $customer->phone,
                        'device_id' => $device ? $device->id : null,
                        'source' => $device ? $device->mode : 'terminal',
                        'status' => 'pending',
                        'requested_points' => $visitPts,
                    ]);

                    $this->pointRequestService->applyPoints($visitRequest);
                    $visitRequest->update(['status' => 'auto_approved', 'approved_at' => now()]);
                    
                    $bonusMessage .= " + Pontos da Visita: {$visitPts} pts";
                }

                $successMsg = "✅ Cadastro realizado com sucesso!{$bonusMessage}{$linkMessage}";
                
                if ($bonus > 0 || $visitPts > 0) {
                    $totalPts = $bonus + $visitPts;
                    $summaryMsg = "🎁 <b>Cadastro e Pontuação Direta</b>\n"
                               . "👤 <b>Cliente:</b> {$customer->name}\n"
                               . "💰 <b>Total Creditado:</b> {$totalPts} pts"
                               . ($linkMessage ? "\n💳 <b>Cartão VIP Vinculado\!</b>" : "");
                    
                    try {
                        if ($device && $device->telegram_chat_id) {
                            $this->telegramService->sendDirectMessage($device->telegram_chat_id, $summaryMsg);
                        } else {
                            $this->telegramService->sendMessage($tenant->id, $summaryMsg);
                        }
                    } catch (\Exception $te2) {
                         \Illuminate\Support\Facades\Log::warning("Registration point Telegram alert failed: " . $te2->getMessage());
                    }
                }

                $goal = $tenant->points_goal;
                if (is_array($levels) && count($levels) > 0) {
                    $goal = (int)($levels[0]['goal'] ?? $goal);
                }

                return ApiResponse::ok([
                    'customer_exists' => true,
                    'points_balance' => $customer->fresh()->points_balance,
                    'loyalty_level_name' => $customer->fresh()->loyalty_level_name,
                    'points_goal' => $goal,
                    'id' => $customer->id,
                    'name' => $customer->name,
                    'is_premium' => false,
                    'message' => $successMsg
                ], $successMsg);
            });
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error("Registration error in PublicTerminalController: " . $e->getMessage(), [
                'exception' => $e,
                'phone' => $request->phone,
                'tenant_slug' => $slug
            ]);
            return ApiResponse::error('Não foi possível completar seu cadastro agora. Por favor, tente novamente.', 'REGISTRATION_ERROR', 500);
        }
    }

    public function linkVip(Request $request, $slug, $uid)
    {
        $request->validate([
            'phone' => 'required|string',
            'target_uid' => 'required|string',
            'pin' => 'sometimes|nullable|string'
        ]);

        return DB::transaction(function () use ($request, $slug, $uid) {
            [$tenant, $device] = $this->validateDevice($slug, $uid);

            $phone = PhoneHelper::normalize($request->phone);
            $customer = Customer::where('tenant_id', $tenant->id)->where('phone', $phone)->firstOrFail();

            // Handle Lost Card / Re-linking
            // If customer already has a card, we unlink the old one first
            \App\Models\LoyaltyCard::where('tenant_id', $tenant->id)
                ->where('linked_customer_id', $customer->id)
                ->update([
                    'linked_customer_id' => null,
                    'status' => 'deactivated', // or 'available' if you want it reusable, but deactivated is safer for lost cards
                    'active' => false
                ]);

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

            return ApiResponse::ok(null, 'Cartão VIP vinculado com sucesso. O cartão anterior (se houver) foi invalidado.');
        });
    }

    public function getRequestStatus($slug, $uid, $requestId)
    {
        $requestRecord = \App\Models\PointRequest::with(['customer', 'store.loyaltySettings'])->findOrFail($requestId);
        
        $customer = $requestRecord->customer;
        $tenant = $requestRecord->store;
        $loyalty = $tenant->loyaltySettings;
        
        $levelsConfig = $loyalty ? $loyalty->levels_config : null;
        $currentLevel = $customer->loyalty_level ?? 0;
        
        $goal = $tenant->points_goal;
        if (is_array($levelsConfig) && isset($levelsConfig[$currentLevel])) {
            $goal = (int)($levelsConfig[$currentLevel]['goal'] ?? $goal);
        }

        return ApiResponse::ok([
            'status' => $requestRecord->status,
            'customer_name' => $customer->name,
            'points_balance' => $customer->points_balance,
            'loyalty_level_name' => $customer->loyalty_level_name,
            'points_goal' => $goal,
            'remaining_points' => max(0, $goal - $customer->points_balance),
            'tenant_name' => $tenant->name
        ]);
    }
}
