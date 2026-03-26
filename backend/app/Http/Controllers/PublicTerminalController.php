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

        // New Device structure: uid is now nfc_uid
        // We use the raw UID to support alphanumeric totems (e.g. Str::random(12))
        $device = Device::withoutGlobalScopes()->where('nfc_uid', $uid)
            ->where('tenant_id', $tenant->id)
            ->first();

        if (!$device) {
            abort(404, "Dispositivo não reconhecido. (Slug: {$slug}, UID: {$uid})");
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
             // Physical Loyalty Cards were deprecated in v2.2
             // We only support Totems and Web flow now.
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
            'session_token' => $this->generateSessionToken($request, $tenant->id, $device ? $device->id : null)
        ]);
    }

    private function generateSessionToken(Request $request, $tenantId, $deviceId)
    {
        $ip = $request->ip();
        $ua = $request->header('User-Agent');
        $token = bin2hex(random_bytes(16));
        $expiresAt = now()->addMinutes(30);

        \Illuminate\Support\Facades\Cache::put("terminal_session:{$token}", [
            'tenant_id' => $tenantId,
            'device_id' => $deviceId,
            'ip' => $ip,
            'ua' => $ua
        ], $expiresAt);

        return $token;
    }

    private function validateSessionToken(Request $request, $token, $tenantId)
    {
        if (!$token) return false;
        
        $session = \Illuminate\Support\Facades\Cache::get("terminal_session:{$token}");
        if (!$session) return false;

        if ($session['tenant_id'] != $tenantId) return false;
        if ($session['ip'] != $request->ip()) return false;
        if ($session['ua'] != $request->header('User-Agent')) return false;

        return true;
    }

    private function invalidateSessionToken($token)
    {
        if ($token) {
            \Illuminate\Support\Facades\Cache::forget("terminal_session:{$token}");
        }
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
        
        // MEASURE B: Digital Session Binding for Lookup
        if (!$this->validateSessionToken($request, $request->session_token, $tenant->id)) {
            $msg = $uid ? 'Sessão inválida para consulta. Por favor, reinicie o processo no totem.' : 'Sessão expirada. Por favor, recarregue a página e tente novamente.';
            return ApiResponse::error($msg, 'SESSION_REQUIRED', 403);
        }
        
        try {
            $res = $this->findCustomer($tenant->id, $request->phone);
            $customer = $res['customer'];
            $variations = $res['variations'];

            \Illuminate\Support\Facades\Log::debug("LOOKUP: Tenant: {$tenant->slug} ({$tenant->id}) | Raw: {$request->phone} | Variations: " . implode(', ', $variations) . " | Found: " . ($customer ? 'YES ('.$customer->id.')' : 'NO'));
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error("LOOKUP ERROR: " . $e->getMessage());
            return ApiResponse::error("Erro interno ao processar busca: " . $e->getMessage(), 'INTERNAL_ERROR', 500);
        }

        if (!$customer) {
            return ApiResponse::ok([
                'customer_exists' => false,
                'points_balance' => 0,
                'debug_variations' => $variations // Helpful for troubleshooting
            ]);
        }


        $balance = $customer->points_balance;
        
        // Get loyalty config with auto-repair
        $loyalty = \App\Models\LoyaltySetting::withoutGlobalScopes()->where('tenant_id', $tenant->id)->first();
        $levelsConfig = $loyalty ? $loyalty->levels_config : null;
        
        // AUTO-REPAIR: If Prata goal is still 20 instead of 24
        if ($loyalty && is_array($levelsConfig) && isset($levelsConfig[1]) && $levelsConfig[1]['goal'] == 20) {
             $levelsConfig[1]['goal'] = 24;
             $levelsConfig[2]['goal'] = 45;
             $levelsConfig[3]['goal'] = 80;
             $loyalty->levels_config = $levelsConfig;
             $loyalty->save();
             \Illuminate\Support\Facades\Cache::forget("tenant_{$tenant->id}_loyalty_levels");
        }

        $currentLevel = $customer->loyalty_level ?? 1; // Default to level 1 (Bronze) if null

        
        $goal = $tenant->points_goal;
        $reward = "prêmio";
        $daysToDowngrade = 0;
        $lvlIdx = max(0, (int)$currentLevel - 1); // 1-indexed to 0-indexed
        if (is_array($levelsConfig) && isset($levelsConfig[$lvlIdx])) {
            $goal = (int)($levelsConfig[$lvlIdx]['goal'] ?? $goal);
            $reward = $levelsConfig[$lvlIdx]['reward'] ?? $reward;
            $daysToDowngrade = (int)($levelsConfig[$lvlIdx]['days_to_downgrade'] ?? 0);
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

        // Check for pending announcements and clear
        $prefs = $customer->preferences ?? [];
        $showLevelUp = $prefs['pending_level_up_announcement'] ?? false;
        if ($showLevelUp) {
            unset($prefs['pending_level_up_announcement']);
            $customer->preferences = $prefs;
            $customer->save();
        }

        return ApiResponse::ok([
            'customer_exists' => true,
            'id' => $customer->id,
            'name' => $customer->name,
            'points_balance' => $balance,
            'points_goal' => $goal,
            'reward_name' => $reward,
            'remaining' => $remaining,
            'days_to_downgrade' => $daysToDowngrade,
            'show_level_up' => $showLevelUp, // Pass to frontend
            'history' => $history,
            'loyalty_level' => $customer->loyalty_level,
            'loyalty_level_name' => $customer->loyalty_level_name,
            'foto_perfil_url' => $customer->photo_url_full,
            'foto_perfil_thumb_url' => $customer->foto_perfil_thumb_url
        ]);
    }

    public function updatePhoto(Request $request, $slug, $uid = null)
    {
        $request->validate([
            'phone' => 'required|string',
            'photo' => 'required', // can be file or base64
            'token' => 'nullable|string'
        ]);

        [$tenant, $device] = $this->validateDevice($slug, $uid, $request->token);
        
        $phone = PhoneHelper::normalize($request->phone);
        $customer = Customer::withoutGlobalScopes()->where('tenant_id', $tenant->id)
            ->where('phone', $phone)
            ->first();

        if (!$customer) {
            return ApiResponse::error('Cliente não encontrado.', 'NOT_FOUND', 404);
        }

        // 60s cooldown
        $prefs = $customer->preferences ?? [];
        $lastUpdate = $prefs['last_photo_update'] ?? 0;
        if (time() - $lastUpdate < 60) {
            return ApiResponse::error('Aguarde 60 segundos entre alterações de foto.', 'COOLDOWN', 429);
        }

        $photoData = $request->photo;
        if ($request->hasFile('photo')) {
            $photoData = $request->file('photo');
        }

        $service = app(\App\Services\CustomerPhotoService::class);
        $path = $service->processAndSave($photoData, $customer->id);
        
        $prefs['last_photo_update'] = time();
        $customer->update([
            'foto_perfil_url' => $path,
            'preferences' => $prefs
        ]);

        return ApiResponse::ok([
            'foto_perfil_url' => $customer->photo_url_full,
            'foto_perfil_thumb_url' => $customer->foto_perfil_thumb_url
        ], 'Foto atualizada com sucesso!');
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
            
            // MEASURE B: Digital Session Binding (IP + User Agent)
            if (!$this->validateSessionToken($request, $request->session_token, $tenant->id)) {
                return ApiResponse::error('Sessão inválida ou expirada. Você deve estar fisicamente na loja para pontuar.', 'SESSION_REQUIRED', 403);
            }

            // MEASURE B: Presence detection
            if (!$device && !$token) {
                return ApiResponse::error('Esta ação exige presença física na loja (NFC ou QRCode do Totem).', 'DEVICE_REQUIRED', 403);
            }

            try {
                $res = $this->findCustomer($tenant->id, $request->phone);
                $customer = $res['customer'];
                $phone = PhoneHelper::normalize($request->phone);
            } catch (\Throwable $e) {
                return ApiResponse::error("Erro na busca de cliente: " . $e->getMessage(), 'INTERNAL_ERROR', 500);
            }



            $isNew = false;
            if (!$customer) {
                if ($tenant->isLimitReached()) {
                    $this->telegramService->sendMessage($tenant->id, "🚫 <b>Limite Atingido!</b> O cadastro de novos clientes foi pausado.");
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
                $newMessage = "🆕 <b>Novo Cliente (Pontuação Balcão)</b>\n"
                            . "📞 <b>Telefone:</b> {$escPhone}";
                
                // For New Registrations, we always use the General Chat ID (settings->telegram_chat_id)
                \App\Jobs\SendTelegramNotificationJob::dispatch(
                    $tenant->id, 
                    $newMessage, 
                    'registration'
                );
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

            // MEASURE C: Visit Cooldown (12 hours)
            $cooldownHours = 12;
            $recentVisit = \App\Models\Visit::where('customer_id', $customer->id)
                ->where('tenant_id', $tenant->id)
                ->whereIn('status', ['pendente', 'aprovado'])
                ->where('visit_at', '>=', now()->subHours($cooldownHours))
                ->first();

            if ($recentVisit) {
                return ApiResponse::error("Aguarde {$cooldownHours}h entre visitas para pontuar novamente.", 'VISIT_COOLDOWN', 429);
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

            $pointsToAdd = ($loyalty->regular_points_per_scan ?? 1); 

            if (is_array($levelsConfig)) {
                $lvlIdx = max(0, (int)$currentLevel - 1);
                if (isset($levelsConfig[$lvlIdx]) && isset($levelsConfig[$lvlIdx]['points_per_visit'])) {
                    $pointsToAdd = (int) $levelsConfig[$lvlIdx]['points_per_visit'];
                }
            }

            // DETERMINAR SE PODE AUTO-APROVAR (ELITE já nasce aprovado, PRO pendente)
            $isElite = strtolower($tenant->plan) === 'elite';
            $isPro = strtolower($tenant->plan) === 'pro';
            
            $status = $isElite ? 'aprovado' : 'pendente';
            $approvedAt = $isElite ? now() : null;

            // CRIAR REGISTRO DE VISITA
            $visit_data = [
                'tenant_id' => $tenant->id,
                'customer_id' => $customer->id,
                'customer_name' => $customer->name,
                'customer_phone' => $customer->phone,
                'customer_company' => $customer->company_name,
                'foto_perfil_url' => $customer->foto_perfil_url,
                'visit_at' => now(),
                'origin' => $token ? 'nfc' : ($device ? 'qr' : 'manual'),
                'plan_type' => $tenant->plan,
                'status' => $status,
                'points_granted' => $pointsToAdd,
                'approved_at' => $approvedAt,
            ];

            // Safety catch for device_id
            try {
                if ($device) {
                    $visit_data['device_id'] = $device->id;
                }
                $visit = \App\Models\Visit::create($visit_data);
            } catch (\Exception $de) {
                \Illuminate\Support\Facades\Log::error("EARN_ERROR: Visit creation failed: " . $de->getMessage());
                // Try once more without device_id in case column is missing
                if (isset($visit_data['device_id'])) {
                    unset($visit_data['device_id']);
                    $visit = \App\Models\Visit::create($visit_data);
                } else {
                    throw $de;
                }
            }

            if ($isElite) {
                // Apply points immediately for Elite
                $customer->increment('points_balance', $visit->points_granted);
                $customer->increment('attendance_count');
                
                \App\Models\PointMovement::create([
                    'tenant_id' => $tenant->id,
                    'customer_id' => $customer->id,
                    'type' => 'earn',
                    'points' => $visit->points_granted,
                    'origin' => $visit->origin,
                    'description' => 'Pontos creditados automaticamente (Plano Elite)',
                    'meta' => ['visit_id' => $visit->id]
                ]);

                // NOTIFICAÇÃO INFORMATIVA PARA O ELITE (Sem botões de aprovação)
                $settings = \App\Models\TenantSetting::where('tenant_id', $tenant->id)->first();
                $targetChatId = ($device && $device->telegram_chat_id) ? $device->telegram_chat_id : ($settings ? $settings->telegram_chat_id : null);
                
                if ($targetChatId) {
                    $locationName = $device ? ($device->responsible_name ?: $device->name) : 'Terminal Público';
                    
                    // Check if Goal Reached for Elite
                    $goal = $tenant->points_goal;
                    $lvlIdx = max(0, (int)$customer->loyalty_level - 1);
                    if (is_array($levelsConfig) && isset($levelsConfig[$lvlIdx])) {
                        $goal = (int)($levelsConfig[$lvlIdx]['goal'] ?? $goal);
                    }
                    
                    $metaAlert = "";
                    if ($customer->points_balance >= $goal) {
                        $metaAlert = "🏆 <b>META ALCANÇADA!</b> 🏆\n"
                                   . "Prêmio disponível na <b>próxima visita</b>! 🎁\n\n";
                    }

                    $caption = $metaAlert 
                             . "✅ <b>PONTO REGISTRADO</b>\n\n"
                             . "👤 {$customer->name}\n"
                             . "📊 Total de visitas: {$customer->attendance_count}\n"
                             . "💰 Saldo atual: {$customer->points_balance} / {$goal}\n"
                             . "📅 " . now()->format('d/m/Y') . "\n"
                             . "🕒 " . now()->format('H:i');
                    
                    $replyMarkup = null;
                    if ($customer->points_balance + $pointsToGrant >= $goal) {
                        $replyMarkup = [
                            'inline_keyboard' => [
                                [['text' => '🎁 PREMIAR AGORA!', 'callback_data' => "redeem_reward:{$customer->id}"]]
                            ]
                        ];
                    }

                    \App\Jobs\SendTelegramNotificationJob::dispatch(
                        $tenant->id, 
                        $caption, 
                        'points', 
                        $targetChatId, 
                        $replyMarkup, 
                        $customer->photo_url_full
                    );
                }

                try {
                    // Force broadcast for real-time UI updates
                    // Note: Removed the object cast to avoid TypeError in PointRequestStatusUpdated constructor
                    // if we don't have a real PointRequest model here.
                    // Instead, we rely on polling for now to avoid breaking the flow.
                    // event(new \App\Events\PointRequestStatusUpdated(...)); 
                } catch (\Throwable $ee) {
                    \Illuminate\Support\Facades\Log::warning("Broadcast failed in earn: " . $ee->getMessage());
                }
            } elseif ($isPro) {
                $settings = \App\Models\TenantSetting::where('tenant_id', $tenant->id)->first();
                $targetChatId = ($device && $device->telegram_chat_id) ? $device->telegram_chat_id : ($settings ? $settings->telegram_chat_id : null);
                $isSoundEnabled = $device ? $device->telegram_sound_points : ($settings ? $settings->telegram_sound_points : true);

                if ($targetChatId && $isSoundEnabled) {
                    $locationName = $device ? ($device->responsible_name ?: $device->name) : 'Terminal Público';
                    // Check if Goal Reached for PRO Approval Request
                    $goal = $tenant->points_goal;
                    $lvlIdx = max(0, (int)$customer->fresh()->loyalty_level - 1);
                    if (is_array($levelsConfig) && isset($levelsConfig[$lvlIdx])) {
                        $goal = (int)($levelsConfig[$lvlIdx]['goal'] ?? $goal);
                    }
                    
                    $metaAlert = "";
                    $potentialBalance = $customer->points_balance + $pointsToAdd;
                    if ($potentialBalance >= $goal) {
                        $metaAlert = "🏆 <b>META SENDO ALCANÇADA!</b> 🏆\n"
                                   . "Ao aprovar, o cliente atingirá a meta!\n\n";
                    }

                    $caption = $metaAlert
                             . "⭐ <b>Solicitação de ponto</b>\n\n"
                             . "<b>Cliente:</b> {$customer->name}\n"
                             . "<b>Telefone:</b> {$customer->phone}\n";
                    if ($customer->company_name) {
                        $caption .= "<b>Empresa:</b> {$customer->company_name}\n";
                    }
                    $caption .= "<b>Visitas:</b> {$customer->attendance_count}\n"
                             . "<b>Saldo:</b> {$customer->points_balance} (+{$pointsToAdd}) / {$goal}\n"
                             . "<b>Hora:</b> " . now()->format('H:i') . "\n\n"
                             . "<b>📍 Local:</b> {$locationName}";
                    
                    $replyMarkup = [
                        'inline_keyboard' => [
                            [
                                ['text' => '✅ APROVAR PONTO', 'callback_data' => "approve_visit:{$visit->id}"],
                                ['text' => '❌ Negar', 'callback_data' => "reject_visit:{$visit->id}"]
                            ]
                        ]
                    ];

                    // If meta will be reached, suggest reward
                    if ($customer->points_balance + $pointsToAdd >= $goal) {
                        $replyMarkup['inline_keyboard'][] = [
                            ['text' => '🎁 PREMIAR AGORA!', 'callback_data' => "redeem_reward:{$customer->id}"]
                        ];
                    }
                    
                    $tgRes = $this->telegramService->sendPhoto($tenant->id, $customer->photo_url_full, $caption, 'points', $replyMarkup, $targetChatId);
                    
                    if ($tgRes && isset($tgRes['result']['message_id'])) {
                        $meta = $visit->meta ?? [];
                        $meta['telegram_message_id'] = $tgRes['result']['message_id'];
                        $meta['telegram_chat_id'] = $targetChatId;
                        $visit->update(['meta' => $meta]);
                    }
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

            $canAutoApprove = ($status === 'aprovado');

            $msg = ($canAutoApprove ? "✅ +{$pointsToAdd} ponto(s) adicionado(s) com sucesso." : "Solicitação de +{$pointsToAdd} ponto(s) enviada.") 
                 . " Saldo: {$newBalance} / Meta: {$goal}.";
            
            if ($newBalance >= $goal) {
                $msg .= " 🎉 META ATINGIDA!";
            }

            $response = ApiResponse::ok([
                'request_id' => $visit->id,
                'customer_name' => $customer->name,
                'points_earned' => $pointsToAdd, 
                'new_balance' => $newBalance,
                'loyalty_level' => $customer->fresh()->loyalty_level,
                'loyalty_level_name' => $customer->fresh()->loyalty_level_name,
                'points_goal' => $goal,
                'message' => $msg,
                'auto_approved' => $canAutoApprove
            ]);

            // MEASURE D: Session Auto-Destruction (One-Time Use)
            $this->invalidateSessionToken($request->session_token);

            return $response;
        });
    }

    public function autoEarn(Request $request, $slug, $uid = null)
    {
        return $this->earn($request, $slug, $uid);
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

            // MEASURE B: Digital Session Binding for Redeem
            if (!$this->validateSessionToken($request, $request->session_token, $tenant->id)) {
                return ApiResponse::error('Sessão inválida para resgate. O resgate deve ser feito presencialmente.', 'SESSION_REQUIRED', 403);
            }

            // MEASURE B: Presence detection for Redeem
            if (!$device && !$token) {
                return ApiResponse::error('O resgate de prêmios deve ser feito presencialmente no caixa ou totem.', 'DEVICE_REQUIRED', 403);
            }

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

            $pointsToAdd = ($loyalty->regular_points_per_scan ?? 1);

            // Important: As we are redeeming and moving to the next level, the visit point
            // should follow the configuration of that next level.
            $nextLevelIdx = $currentLevel; // If currentLevel is Bronze (1), index 1 is Silver.
            if (is_array($levelsConfig) && isset($levelsConfig[$nextLevelIdx]) && isset($levelsConfig[$nextLevelIdx]['points_per_visit'])) {
                $pointsToAdd = (int) $levelsConfig[$nextLevelIdx]['points_per_visit'];
            }

            $bonus = $loyalty->redeem_bonus_points ?? 0;
            $vipInitial = $loyalty->vip_initial_points ?? 0;

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
                    'became_premium' => false
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
            } elseif ($requestRecord->status === 'pending' && ($tenant->plan === 'Pro' || $tenant->plan === 'pro')) {
                $settings = \App\Models\TenantSetting::where('tenant_id', $tenant->id)->first();
                $targetChatId = ($device && $device->telegram_chat_id) ? $device->telegram_chat_id : ($settings ? $settings->telegram_chat_id : null);
                $isSoundEnabled = $device ? $device->telegram_sound_points : ($settings ? $settings->telegram_sound_points : true);

                if ($targetChatId && $isSoundEnabled) {
                    $locationName = $device ? ($device->responsible_name ?: $device->name) : 'Terminal Público';
                    
                    $caption = "👑 <b>Solicitação de Resgate</b>\n\n"
                             . "<b>Cliente:</b> {$customer->name}\n"
                             . "<b>Telefone:</b> {$customer->phone}\n";
                    if ($customer->company_name) {
                        $caption .= "<b>Empresa:</b> {$customer->company_name}\n";
                    }
                    $caption .= "<b>Visitas:</b> {$customer->attendance_count}\n"
                             . "<b>Hora:</b> " . now()->format('H:i') . "\n\n"
                             . "<b>📍 Local:</b> {$locationName}\n\n"
                             . "Deseja aprovar o resgate de prêmio para este cliente?";
                    
                    $replyMarkup = [
                        'inline_keyboard' => [
                            [
                                ['text' => '✅ Aprovar Resgate', 'callback_data' => "approve_request:{$requestRecord->id}"],
                                ['text' => '❌ Negar', 'callback_data' => "reject_request:{$requestRecord->id}"]
                            ]
                        ]
                    ];
                    
                    $tgRes = $this->telegramService->sendPhoto($tenant->id, $customer->photo_url_full, $caption, 'points', $replyMarkup, $targetChatId);
                    
                    if ($tgRes && isset($tgRes['result']['message_id'])) {
                        $meta = $requestRecord->meta ?? [];
                        $meta['telegram_message_id'] = $tgRes['result']['message_id'];
                        $meta['telegram_chat_id'] = $targetChatId;
                        $requestRecord->update(['meta' => $meta]);
                    }
                }
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

            $response = ApiResponse::ok([
                'request_id' => $requestRecord->id,
                'customer_name' => $customer->name,
                'new_balance' => $newBalance,
                'loyalty_level_name' => $customer->loyalty_level_name,
                'points_goal' => $goal,
                'message' => $msg,
                'auto_approved' => $isElite
            ]);

            // MEASURE D: Session Auto-Destruction (One-Time Use)
            $this->invalidateSessionToken($request->session_token);

            return $response;
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
                
                // CRITICAL: Use SAME logic as lookup to detect already registered customers
                $existing = $this->findCustomer($tenant->id, $data['phone']);

                if ($existing['customer']) {
                    return ApiResponse::error('Este número de telefone já está cadastrado nesta loja. Para visualizar os pontos, utilize a opção Consultar saldo.', 'DUPLICATE_PHONE', 409);
                }


                // Limit Check
                if ($tenant->isLimitReached()) {
                    $this->telegramService->sendMessage($tenant->id, "🚫 <b>Limite Atingido!</b> O cadastro de novos clientes foi pausado.");
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

                if ($request->photo) {
                    $service = app(\App\Services\CustomerPhotoService::class);
                    $path = $service->processAndSave($request->photo, $customer->id);
                    $customer->update(['foto_perfil_url' => $path]);
                }

                $tenant->verifyAndNotifyLimit();

                $loyalty = \App\Models\LoyaltySetting::withoutGlobalScopes()->firstOrCreate(['tenant_id' => $tenant->id]);
                $levels = $loyalty->levels_config;
                
                // Award Points (Welcome Bonus)
                // If it's a "Web Join" (no device), give exactly 1 point as requested.
                // If it's at the totem/card, give the level points.
                $visitPts = 1; 
                if ($device || $token) {
                    // Prioritize level-specific signup points (maps to "Ponto por cadastro" in UI)
                    $visitPts = (is_array($levels) && count($levels) > 0 && isset($levels[0]['points_per_signup'])) 
                        ? (int)$levels[0]['points_per_signup'] 
                        : (int)($loyalty->signup_bonus_points ?? 1);
                }

                $escName = TelegramService::escapeMarkdownV2($customer->name);
                $escPhone = TelegramService::escapeMarkdownV2($customer->phone);
                $regMessage = "✨ <b>Novo Cliente Cadastrado (Totem)</b>\n\n"
                            . "👤 <b>Nome:</b> {$escName}\n"
                            . "📞 <b>Telefone:</b> {$escPhone}\n"
                            . "💰 <b>Ponto de cadastro recebido:</b> {$visitPts}";

                try {
                    // Use sendPhoto for better visual consistency (includes avatar)
                    $this->telegramService->sendPhoto($tenant->id, $customer->photo_url_full, $regMessage, 'registration');
                } catch (\Exception $te) {
                    \Illuminate\Support\Facades\Log::warning("Registration Telegram alert failed: " . $te->getMessage());
                }

                // Link Card if deviceUid is present
                $linkMessage = "";
                if ($deviceUid && $deviceUid !== 'null') {
                    // Physical card linking is deprecated
                }

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
                    'foto_perfil_url' => $refreshed->photo_url_full,
                    'foto_perfil_thumb_url' => $refreshed->foto_perfil_thumb_url,
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
    private function findCustomer($tenantId, $phoneInput)
    {
        $raw = preg_replace('/\D/', '', (string)$phoneInput);
        $norm = PhoneHelper::normalize((string)$phoneInput);
        $variations = array_unique(array_filter([$raw, $norm, (string)$phoneInput], function($v) { return !empty($v); }));
        
        // Extended Japan prefix variations
        if (strpos($norm, '0') === 0 && strlen($norm) >= 10) {
            $noPrefix = substr($norm, 1);
            $variations[] = $noPrefix;
            $variations[] = '81' . $noPrefix;
        } elseif (strpos($norm, '81') === 0 && strlen($norm) >= 11) {
            $noPrefix = substr($norm, 2);
            $variations[] = $noPrefix;
            $variations[] = '0' . $noPrefix;
            if (strpos($noPrefix, '0') === 0) {
                 $variations[] = substr($noPrefix, 1);
            }
        } elseif (strlen($norm) == 10) {
            $variations[] = '0' . $norm;
            $variations[] = '81' . $norm;
        }

        // Direct database query bypassing Eloquent scopes for maximum reliability
        $dbCustomer = DB::table('customers')
            ->where('tenant_id', $tenantId)
            ->where(function($q) use ($variations) {
                $q->whereIn('phone', $variations);
                // Also try matching the last 9 digits as a fallback for formatting differences
                foreach($variations as $v) {
                    if (strlen($v) >= 9) {
                        $last9 = substr($v, -9);
                        $q->orWhere('phone', 'LIKE', '%' . $last9);
                    }
                }
            })
            ->first();

        if ($dbCustomer) {
            $customer = Customer::withoutGlobalScopes()->find($dbCustomer->id);
            return ['customer' => $customer, 'variations' => $variations];
        }
        
        return ['customer' => null, 'variations' => $variations];
    }

    private function createPointRequest(array $data)
    {
        return \App\Models\PointRequest::create($data);
    }
}



