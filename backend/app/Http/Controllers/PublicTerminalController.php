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
            $isValid = $this->qrTokenService->isValid($token, $tenant->id);
            if ($isValid) {
                $device = $this->deviceService->getOrCreateOnlineQrDevice($tenant->id);
                return [$tenant, $device];
            } else {
                // If token is invalid/used, only allow proceeding if user is an admin
                // This prevents blocking general users from seeing the store page if they have a stale token.
                if (auth('sanctum')->check()) {
                   // Admin can proceed without a valid token (web flow)
                } else {
                    // For customers, if they have a token, it MUST be valid to use it as a device-identifier
                    // But maybe we should just return no device?
                    // Let's stick to 403 for now as it's the current behavior, but make it clearer.
                    return [$tenant, null]; 
                }
            }
        }

        if (!$uid || $uid === 'null') {
            return [$tenant, null];
        }

        // Clean UID (Same logic as VipCardController to support numeric UIDs with separators)
        $uid = preg_replace('/\D/', '', $uid);

        // New Device structure: uid is now nfc_uid
        $device = Device::withoutGlobalScopes()->where('nfc_uid', $uid)
            ->where('tenant_id', $tenant->id)
            ->first();

        if (!$device) {
            abort(404, 'Dispositivo não reconhecido.');
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

        // Check if device is a linked card
        $prefillPhone = null;
        $deviceType = $device ? $device->type : 'web';

        if ($uid && $uid !== 'null') {
            $card = \App\Models\LoyaltyCard::withoutGlobalScopes()
                ->where('uid', $uid)
                ->where('tenant_id', $tenant->id)
                ->where('status', 'linked')
                ->first();
            if ($card && $card->customer) {
                $prefillPhone = $card->customer->phone;
                $deviceType = 'premium';
            }
        }

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
            'device_type' => $deviceType,
            'prefill_phone' => $prefillPhone,
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
        $customer = Customer::withoutGlobalScopes()->where('tenant_id', $tenant->id)
            ->where('phone', $phone)
            ->first();

        if (!$customer) {
            return ApiResponse::ok([
                'customer_exists' => false,
                'points_balance' => 0
            ]);
        }

        $balance = $customer->points_balance;
        $loyalty = \App\Models\LoyaltySetting::withoutGlobalScopes()->where('tenant_id', $tenant->id)->first();
        $levelsConfig = $loyalty ? $loyalty->levels_config : null;
        $currentLevel = $customer->loyalty_level ?? 1; // Default to level 1 (Bronze) if null
        
        $goal = $tenant->points_goal;
        $lvlIdx = max(0, (int)$currentLevel - 1); // 1-indexed to 0-indexed
        if (is_array($levelsConfig) && isset($levelsConfig[$lvlIdx])) {
            $goal = (int)($levelsConfig[$lvlIdx]['goal'] ?? $goal);
        }
        $remaining = max(0, $goal - $balance);

        // Get recent history
        $history = PointMovement::withoutGlobalScopes()
            ->where('customer_id', $customer->id)
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

    public function earn(Request $request, $slug, $uid = null)
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
                try {
                    $this->qrTokenService->consumeToken($token, $tenant->id);
                } catch (\Throwable $te) {
                    // Ignore consumption error ONLY if we are an admin and token was already used
                    if (!auth('sanctum')->check()) {
                        return ApiResponse::error($te->getMessage(), 'TOKEN_ERROR', 400);
                    }
                }
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

            $loyalty = \App\Models\LoyaltySetting::firstOrCreate(['tenant_id' => $tenant->id]);
            $levelsConfig = $loyalty->levels_config;
            $customer = $customer->fresh(); // Ensure we have latest points state
            $currentLevel = $customer->loyalty_level ?? 0;

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
                $lvlIdx = max(0, (int)$currentLevel - 1);
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
            // If merchant is logged in, auto-approve
            if (auth('sanctum')->check()) {
                $canAutoApprove = true;
            } elseif ($isElite) {
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
                
                try {
                    event(new \App\Events\PointRequestStatusUpdated($requestRecord));
                } catch (\Throwable $ee) {
                    \Illuminate\Support\Facades\Log::warning("Broadcast failed in earn: " . $ee->getMessage());
                }
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

            $customer = $customer->fresh();
            $newBalance = $customer->points_balance;
            $newLevel = (int)($customer->loyalty_level ?? 1);
            
            $goal = $tenant->points_goal;
            $lvlIdx = max(0, $newLevel - 1); // Use the NEW level for the NEW goal
            if (is_array($levelsConfig) && isset($levelsConfig[$lvlIdx])) {
                $goal = (int)($levelsConfig[$lvlIdx]['goal'] ?? $goal);
            }

            $msg = ($canAutoApprove ? "✅ +{$pointsToAdd} ponto(s) adicionado(s) com sucesso." : "Solicitação de +{$pointsToAdd} ponto(s) enviada.") 
                 . " Saldo: {$newBalance} / Meta: {$goal}.";
            
            if ($newBalance >= $goal) {
                $msg .= " 🎉 META ATINGIDA!";
            }

            return ApiResponse::ok([
                'request_id' => $requestRecord->id,
                'customer_name' => $customer->name,
                'points_earned' => $pointsToAdd, 
                'new_balance' => $newBalance,
                'loyalty_level' => $customer->fresh()->loyalty_level,
                'loyalty_level_name' => $customer->fresh()->loyalty_level_name,
                'points_goal' => $goal,
                'message' => $msg,
                'auto_approved' => $canAutoApprove
            ]);
        });
    }

    public function redeem(Request $request, $slug, $uid = null)
    {
        $request->validate([
            'phone' => 'required|string',
            'pin' => 'nullable|string',
            'token' => 'nullable|string'
        ]);

        return DB::transaction(function () use ($request, $slug, $uid) {
            $token = $request->token;
            [$tenant, $device] = $this->validateDevice($slug, $uid, $token);

            // Consumption of token if present
            if ($token) {
                try {
                    $this->qrTokenService->consumeToken($token, $tenant->id);
                } catch (\Throwable $te) {
                    // Ignore consumption error ONLY if we are an admin
                    if (!auth('sanctum')->check()) {
                        return ApiResponse::error($te->getMessage(), 'TOKEN_ERROR', 400);
                    }
                }
            }

            // Removed plan-based blockade to unify logic across Classic, Pro, and Elite


            $phone = PhoneHelper::normalize($request->phone);
            $customer = Customer::where('tenant_id', $tenant->id)->where('phone', $phone)->first();

            $loyalty = \App\Models\LoyaltySetting::firstOrCreate(['tenant_id' => $tenant->id]);
            $levelsConfig = $loyalty->levels_config;
            $currentLevel = $customer ? ($customer->loyalty_level ?? 1) : 1;
            
            $goal = $tenant->points_goal;
            $levelName = "Nível VIP";
            $lvlIdx = max(0, (int)$currentLevel - 1); // 1-indexed to 0-indexed
            
            if (is_array($levelsConfig) && isset($levelsConfig[$lvlIdx])) {
                $goal = (int)($levelsConfig[$lvlIdx]['goal'] ?? $goal);
                $levelName = $levelsConfig[$lvlIdx]['name'] ?? $levelName;
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
            
            // If merchant is logged in, auto-approve
            if (auth('sanctum')->check()) {
                $canAutoApprove = true;
            } elseif ($isElite) {
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
                
                try {
                    event(new \App\Events\PointRequestStatusUpdated($requestRecord));
                } catch (\Throwable $ee) {
                    \Illuminate\Support\Facades\Log::warning("Broadcast failed in redeem: " . $ee->getMessage());
                }
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

            $customer = $customer->fresh();
            $newBalance = $customer->points_balance;
            $newLevel = (int)($customer->loyalty_level ?? 1);

            $goal = $tenant->points_goal;
            $lvlIdx = max(0, $newLevel - 1);
            if (is_array($levelsConfig) && isset($levelsConfig[$lvlIdx])) {
                $goal = (int)($levelsConfig[$lvlIdx]['goal'] ?? $goal);
            }

            $msg = 'Solicitação de resgate enviada com sucesso.';
            if ($canAutoApprove) {
                $msg = "Prêmio entregue com sucesso! O cliente reiniciou no nível {$customer->loyalty_level_name} com +{$pointsToAdd} ponto(s).";
            }

            return ApiResponse::ok([
                'request_id' => $requestRecord->id,
                'customer_name' => $customer->name,
                'new_balance' => $newBalance,
                'loyalty_level_name' => $customer->loyalty_level_name,
                'points_goal' => $goal,
                'message' => $msg,
                'auto_approved' => $canAutoApprove
            ]);
        });
    }
    public function register(Request $request, $slug, $uid = null)
    {
        // Accept UID from request body as fallback for unified public page
        $deviceUid = $uid ?: $request->input('device_uid');
        
        $data = $request->all();
        // Convert empty strings or whitespace strings to null for optional fields
        foreach (['email', 'city', 'province', 'postal_code', 'address', 'birthday'] as $field) {
            if (isset($data[$field])) {
                $trimmed = trim($data[$field]);
                $data[$field] = $trimmed === '' ? null : $trimmed;
            }
        }

        $rules = [
            'name' => 'required|string|max:100',
            'phone' => 'required|string',
            'email' => 'sometimes|nullable|email|max:100',
            'city' => 'sometimes|nullable|string|max:100',
            'province' => 'sometimes|nullable|string|max:100',
            'postal_code' => 'sometimes|nullable|string|max:20',
            'address' => 'sometimes|nullable|string|max:255',
            'birthday' => 'sometimes|nullable|date',
        ];

        try {
            \Illuminate\Support\Facades\Validator::make($data, $rules)->validate();
        } catch (\Illuminate\Validation\ValidationException $e) {
            \Illuminate\Support\Facades\Log::error("Registration Validation Failed for {$slug}: " . json_encode($e->errors()));
            return ApiResponse::error('Dados inválidos para cadastro.', 'VALIDATION_ERROR', 422, $e->errors());
        }

        try {
            return DB::transaction(function () use ($data, $slug, $deviceUid, $request) {
                $token = $request->token;
                [$tenant, $device] = $this->validateDevice($slug, $deviceUid, $token);

                // Consumption of token if present to prevent double scoring after registration
                if ($token) {
                    try {
                        $this->qrTokenService->consumeToken($token, $tenant->id);
                    } catch (\Throwable $te) {
                        // Ignore consumption error ONLY if we are an admin
                        if (!auth('sanctum')->check()) {
                            return ApiResponse::error($te->getMessage(), 'TOKEN_ERROR', 400);
                        }
                    }
                }

                $phone = PhoneHelper::normalize($data['phone']);

                // Check for existing
                if (Customer::withoutGlobalScopes()->where('tenant_id', $tenant->id)->where('phone', $phone)->exists()) {
                    return ApiResponse::error('Este número de telefone já está cadastrado nesta loja. Para visualizar os pontos, utilize a opção Consultar saldo.', 'DUPLICATE_PHONE', 409);
                }

                // Limit Check
                if ($tenant->isLimitReached()) {
                    $this->telegramService->sendMessage($tenant->id, "🚫 *Limite Atingido\!* O cadastro de novos clientes foi pausado\.");
                    return ApiResponse::error('Limite de clientes atingido para esta loja.', 'PLAN_LIMIT_REACHED', 403);
                }

                $birthday = $data['birthday'] ?? null;
                if ($birthday === '') $birthday = null;

                $customer = Customer::create([
                    'tenant_id' => $tenant->id,
                    'name' => $data['name'],
                    'phone' => $phone,
                    'email' => $data['email'] ?? null,
                    'city' => $data['city'] ?? null,
                    'province' => $data['province'] ?? null,
                    'postal_code' => $data['postal_code'] ?? null,
                    'address' => $data['address'] ?? null,
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

                $loyalty = \App\Models\LoyaltySetting::withoutGlobalScopes()->firstOrCreate(['tenant_id' => $tenant->id]);
                $levels = $loyalty->levels_config;
                
                // Link Card if deviceUid is present
                $linkMessage = "";
                if ($deviceUid && $deviceUid !== 'null') {
                    $card = \App\Models\LoyaltyCard::withoutGlobalScopes()
                        ->where('tenant_id', $tenant->id)
                        ->where('uid', $deviceUid)
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

                // Award Points
                $visitPts = (is_array($levels) && count($levels) > 0 && isset($levels[0]['points_per_visit'])) 
                    ? (int)$levels[0]['points_per_visit'] 
                    : (int)($loyalty->regular_points_per_scan ?? 1);

                $bonusMessage = "";
                if ($visitPts > 0) {
                    $visitRequest = $this->createPointRequest([
                        'tenant_id' => $tenant->id,
                        'customer_id' => $customer->id,
                        'phone' => $customer->phone,
                        'device_id' => ($device && isset($device->id)) ? $device->id : null,
                        'source' => $device ? ($device->mode ?? 'terminal') : 'terminal',
                        'status' => 'pending',
                        'requested_points' => $visitPts,
                        'meta' => ['is_signup_bonus' => true]
                    ]);

                    $this->pointRequestService->applyPoints($visitRequest);
                    $visitRequest->update(['status' => 'auto_approved', 'approved_at' => now()]);
                    $bonusMessage = " (Bônus: {$visitPts} pts)";
                }

                $successMsg = "✅ Cadastro realizado com sucesso!{$bonusMessage}{$linkMessage}";
                
                $goal = $tenant->points_goal;
                if (is_array($levels) && count($levels) > 0) {
                    $goal = (int)($levels[0]['goal'] ?? $goal);
                }

                $refreshed = $customer->fresh();
                return ApiResponse::ok([
                    'customer_exists' => true,
                    'points_balance' => $refreshed->points_balance,
                    'loyalty_level' => $refreshed->loyalty_level,
                    'loyalty_level_name' => $refreshed->loyalty_level_name,
                    'points_goal' => $goal,
                    'id' => $customer->id,
                    'name' => $customer->name,
                    'is_premium' => (bool)$refreshed->is_premium,
                    'message' => $successMsg
                ], $successMsg);
            });
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error("Registration error for {$slug}: " . $e->getMessage());
            return ApiResponse::error('Erro ao completar cadastro: ' . $e->getMessage(), 'REGISTRATION_ERROR', 500);
        }
    }

    public function getRequestStatus($slug, $uidOrRequestId, $requestId = null)
    {
        // If $requestId is null, it means we are in the /p/{slug} route where only 2 params are passed
        $actualRequestId = $requestId ?: $uidOrRequestId;
        
        $requestRecord = \App\Models\PointRequest::with(['customer', 'store.loyaltySettings'])->findOrFail($actualRequestId);
        
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
