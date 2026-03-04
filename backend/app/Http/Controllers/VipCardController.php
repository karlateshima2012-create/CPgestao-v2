<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\LoyaltyCard;
use App\Models\Tenant;
use App\Http\Responses\ApiResponse;
use App\Services\PointRequestService;
use App\Services\TelegramService;
use Illuminate\Support\Facades\DB;

class VipCardController extends Controller
{
    protected $pointRequestService;
    protected $telegramService;

    public function __construct(PointRequestService $pointRequestService, TelegramService $telegramService)
    {
        $this->pointRequestService = $pointRequestService;
        $this->telegramService = $telegramService;
    }

    public function resolve(Request $request, $uid)
    {
        $uid = trim($uid);
        // Ignorar escopo global pois usuários públicos/deslogados podem acessar
        // Clean UID to use only digits as requested: 12 numeric digits
        $uidClean = preg_replace('/\D/', '', $uid);
        
        $card = LoyaltyCard::withoutGlobalScopes()
            ->where('uid', $uidClean)
            ->where('type', 'premium')
            ->first();

        if (!$card) {
            \Illuminate\Support\Facades\Log::warning("NFC Resolve: Card not found", ['uid' => $uid]);
            return ApiResponse::error('Cartão não encontrado no sistema.', 'CARD_NOT_FOUND', 404);
        }

        $tenant = $card->tenant;
        if (!$tenant) {
             \Illuminate\Support\Facades\Log::warning("NFC Resolve: Card has no tenant", ['uid' => $uid, 'card_id' => $card->id]);
             return ApiResponse::error('Este cartão não está associado a nenhuma loja.', 'TENANT_NOT_FOUND', 404);
        }

        if ($tenant->status !== "active") {
            return ApiResponse::error('A loja associada a este cartão está inativa.', 'TENANT_INACTIVE', 403);
        }

        $isOwner = false;
        try {
            if (auth('sanctum')->check()) {
                $user = auth('sanctum')->user();
                if ($user && $user->role === 'client') {
                    // Check if IDs match (cast to string to be safe with UUIDs/BigInts)
                    if (strval($user->tenant_id) === strval($tenant->id)) {
                        $isOwner = true;
                    }
                }
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error("NFC Resolve: Auth check error: " . $e->getMessage());
        }

        if (!$card->linked_customer_id) {
            return ApiResponse::ok([
                'is_owner' => $isOwner,
                'is_unlinked' => true,
                'card_uid' => $card->uid,
                'tenant' => [
                    'name' => $tenant->name,
                    'slug' => $tenant->slug,
                    'logo_url' => $tenant->logo_url,
                ]
            ]);
        }

        $card->load('customer', 'tenant');
        $customer = $card->customer;

        if (!$customer) {
            return ApiResponse::ok([
                'is_owner' => $isOwner,
                'is_unlinked' => true,
                'card_uid' => $card->uid,
                'tenant' => [
                    'name' => $tenant->name,
                    'slug' => $tenant->slug,
                    'logo_url' => $tenant->logo_url,
                ]
            ]);
        }

        $loyalty = $tenant->loyaltySettings;
        $levelsConfig = $loyalty ? $loyalty->levels_config : null;
        $currentLevel = $customer->loyalty_level ?? 1;
        
        $goal = $tenant->points_goal;
        $lvlIdx = max(0, (int)$currentLevel - 1);
        if (is_array($levelsConfig) && isset($levelsConfig[$lvlIdx])) {
            $goal = (int)($levelsConfig[$lvlIdx]['goal'] ?? $goal);
        }

        // Retorna infos para o Frontend (VipPointHandler) decidir a View
        return ApiResponse::ok([
            'is_owner' => $isOwner,
            'tenant' => [
                'name' => $tenant->name,
                'slug' => $tenant->slug,
                'logo_url' => $tenant->logo_url,
            ],
            'customer' => [
                'name' => $customer->name,
                'points_balance' => $customer->points_balance,
                'loyalty_level' => $customer->loyalty_level,
                'loyalty_level_name' => $customer->loyalty_level_name,
            ],
            'goal' => $goal,
            'card_uid' => $card->uid,
            'points_to_add' => $this->calculatePointsToAdd($customer, $tenant)
        ]);
    }

    protected function calculatePointsToAdd($customer, $tenant, $isRedemption = false)
    {
        $loyalty = $tenant->loyaltySettings;
        $currentLevel = (int)($customer->loyalty_level ?? 1);
        
        // If it's a redemption, we are moving to the NEXT level
        $levelIndex = $isRedemption ? $currentLevel : max(0, $currentLevel - 1);
        
        $levelsConfig = $loyalty ? $loyalty->levels_config : null;

        if (is_array($levelsConfig) && isset($levelsConfig[$levelIndex]) && isset($levelsConfig[$levelIndex]['points_per_visit'])) {
            return (int) $levelsConfig[$levelIndex]['points_per_visit'];
        }
        return $loyalty ? ($loyalty->vip_points_per_scan ?? 1) : 1;
    }

    public function addPoint(Request $request, $uid)
    {
        $uid = trim($uid);
        $uidClean = preg_replace('/\D/', '', $uid);
        
        // Rota protegida auth:sanctum & role:client. BelongsToTenant ativo automaticamente.
        $card = LoyaltyCard::where('uid', $uidClean)->where('type', 'premium')->first();

        if (!$card) {
            return ApiResponse::error('Cartão não encontrado ou não pertence a esta loja.', 'CARD_NOT_FOUND', 404);
        }

        if (!$card->linked_customer_id) {
            return ApiResponse::error('Cartão não vinculado a nenhum cliente.', 'NOT_LINKED', 400);
        }

        try {
            return DB::transaction(function () use ($card) {
                $customer = $card->customer;
                $tenant = $card->tenant;
                
                $loyalty = $tenant->loyaltySettings;
                $pointsToAdd = $this->calculatePointsToAdd($customer, $tenant);

                $requestRecord = $this->createPointRequest([
                    'tenant_id' => $tenant->id,
                    'customer_id' => $customer->id,
                    'phone' => $customer->phone,
                    'device_id' => null,
                    'source' => 'manual_card', 
                    'status' => 'pending',
                    'requested_points' => $pointsToAdd,
                    'meta' => ['is_nfc_scan' => true]
                ]);

                $isAutoApprovePlan = in_array(strtolower($tenant->plan ?? ''), ['elite', 'classic']) || auth('sanctum')->check();
                
                if ($isAutoApprovePlan) {
                    $this->pointRequestService->applyPoints($requestRecord);
                    $requestRecord->update(['status' => 'auto_approved', 'approved_at' => now()]);
                    
                    event(new \App\Events\PointRequestStatusUpdated($requestRecord));

                    $customer->update(['last_activity_at' => now()]);
                    $newBalance = $customer->fresh()->points_balance;
                    
                    $customer = $customer->fresh();
                    $newBalance = $customer->points_balance;
                    
                    // Goal calculation
                    $loyalty = $tenant->loyaltySettings;
                    $levelsConfig = $loyalty ? $loyalty->levels_config : null;
                    $currentLevel = $customer->loyalty_level ?? 1;
                    $currentGoal = $tenant->points_goal;
                    $lvlIdx = max(0, (int)$currentLevel - 1);
                    if (is_array($levelsConfig) && isset($levelsConfig[$lvlIdx])) {
                        $currentGoal = (int)($levelsConfig[$lvlIdx]['goal'] ?? $currentGoal);
                    }
                    
                    return ApiResponse::ok([
                        'points_earned' => $pointsToAdd,
                        'new_balance' => $newBalance,
                        'new_goal' => $currentGoal,
                        'message' => "+ {$pointsToAdd} pontos adicionados com sucesso.",
                        'auto_approved' => true
                    ]);
                } else {
                    $settings = \App\Models\TenantSetting::where('tenant_id', $tenant->id)->first();
                    $chatId = $settings ? $settings->telegram_chat_id : null;

                    if ($chatId) {
                        $escName = TelegramService::escapeMarkdownV2($customer->name ?? 'Cliente');
                        $message = "💳 *Leitura de Cartão\!*\n\n"
                                 . "Deseja confirmar *{$pointsToAdd} ponto\(s\)* para o cliente *{$escName}*?";

                        $replyMarkup = [
                            'inline_keyboard' => [
                                [
                                    ['text' => '✅ APROVAR', 'callback_data' => "approve_request:{$requestRecord->id}"],
                                    ['text' => '❌ RECUSAR', 'callback_data' => "reject_request:{$requestRecord->id}"]
                                ]
                            ]
                        ];

                        $this->telegramService->sendDirectMessage($chatId, $message, false, $replyMarkup);
                        
                        return ApiResponse::ok([
                            'request_id' => $requestRecord->id,
                            'message' => 'Solicitação de pontuação enviada para o Telegram.',
                            'auto_approved' => false
                        ]);
                    } else {
                        return ApiResponse::error('ID de Notificação Telegram não configurado.', 'TELEGRAM_NOT_CONFIGURED', 400);
                    }
                }
            });
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error("Error adding point via NFC: " . $e->getMessage(), [
                'card_uid' => $uid,
                'exception' => $e
            ]);
            return ApiResponse::error("Erro no processamento: " . $e->getMessage(), 'SERVER_ERROR', 500);
        }
    }

    public function redeem(Request $request, $uid)
    {
        $uid = trim($uid);
        $uidClean = preg_replace('/\D/', '', $uid);
        $card = LoyaltyCard::where('uid', $uidClean)->where('type', 'premium')->first();

        if (!$card || !$card->linked_customer_id) {
            return ApiResponse::error('Cartão não encontrado ou não vinculado.', 'NOT_LINKED', 404);
        }

        try {
            return DB::transaction(function () use ($card) {
                $customer = $card->customer;
                $tenant = $card->tenant;
                $loyalty = $tenant->loyaltySettings;
                
                // Calculate goal based on levels
                $levelIdx = max(0, ((int)$customer->loyalty_level ?? 1) - 1);
                $levelsConfig = $loyalty ? $loyalty->levels_config : null;
                $goal = $tenant->points_goal;
                if (is_array($levelsConfig) && isset($levelsConfig[$levelIdx])) {
                    $goal = (int)($levelsConfig[$levelIdx]['goal'] ?? $goal);
                }

                if ($customer->points_balance < $goal) {
                    return ApiResponse::error("Saldo insuficiente para resgate (meta: {$goal} pts)", 'INSUFFICIENT_POINTS', 409);
                }

                // Points to add for the NEXT visit/level
                $pointsToAdd = $this->calculatePointsToAdd($customer, $tenant, true);
                
                $requestRecord = $this->createPointRequest([
                    'tenant_id' => $tenant->id,
                    'customer_id' => $customer->id,
                    'phone' => $customer->phone,
                    'device_id' => null,
                    'source' => 'manual_card',
                    'status' => 'pending',
                    'requested_points' => $pointsToAdd,
                    'meta' => [
                        'is_redemption' => true,
                        'is_nfc_scan' => true,
                        'goal' => $goal
                    ]
                ]);

                // Auto-approve if plan is Elite or Classic OR merchant is authenticated
                $isAutoApprovePlan = in_array(strtolower($tenant->plan ?? ''), ['elite', 'classic']) || auth('sanctum')->check();
                
                if ($isAutoApprovePlan) {
                    $this->pointRequestService->applyPoints($requestRecord);
                    $requestRecord->update(['status' => 'auto_approved', 'approved_at' => now()]);
                    
                    event(new \App\Events\PointRequestStatusUpdated($requestRecord));

                    $customer->update(['last_activity_at' => now()]);
                    $newBalance = $customer->fresh()->points_balance;
                    
                    $customer = $customer->fresh();
                    $newBalance = $customer->points_balance;
                    
                    // Goal calculation for the NEW level
                    $loyalty = $tenant->loyaltySettings;
                    $levelsConfig = $loyalty ? $loyalty->levels_config : null;
                    $currentLevel = $customer->loyalty_level ?? 1;
                    $newGoal = $tenant->points_goal;
                    $lvlIdx = max(0, (int)$currentLevel - 1);
                    if (is_array($levelsConfig) && isset($levelsConfig[$lvlIdx])) {
                        $newGoal = (int)($levelsConfig[$lvlIdx]['goal'] ?? $newGoal);
                    }
                    
                    return ApiResponse::ok([
                        'points_earned' => $pointsToAdd,
                        'new_balance' => $newBalance,
                        'new_goal' => $newGoal,
                        'message' => "Prêmio resgatado e +{$pointsToAdd} pontos do novo nível adicionados.",
                        'auto_approved' => true
                    ]);
                } else {
                    $settings = \App\Models\TenantSetting::where('tenant_id', $tenant->id)->first();
                    $chatId = $settings ? $settings->telegram_chat_id : null;
                    if ($chatId) {
                        $escName = TelegramService::escapeMarkdownV2($customer->name ?? 'Cliente');
                        $message = "🎁 *Pedido de Resgate VIP\!*\n\n"
                                 . "O cliente *{$escName}* deseja resgatar o prêmio do nível *{$customer->loyalty_level_name}*\.";
                        
                        $replyMarkup = [
                            'inline_keyboard' => [[
                                ['text' => '✅ APROVAR', 'callback_data' => "approve_request:{$requestRecord->id}"],
                                ['text' => '❌ RECUSAR', 'callback_data' => "reject_request:{$requestRecord->id}"]
                            ]]
                        ];
                        $this->telegramService->sendDirectMessage($chatId, $message, false, $replyMarkup);
                    }
                    
                    return ApiResponse::ok([
                        'request_id' => $requestRecord->id,
                        'message' => 'Pedido de resgate enviado para o Telegram.',
                        'auto_approved' => false
                    ]);
                }
            });
        } catch (\Exception $e) {
            return ApiResponse::error("Erro no processamento: " . $e->getMessage(), 'SERVER_ERROR', 500);
        }
    }

    protected function createPointRequest(array $data)
    {
        return \App\Models\PointRequest::create($data);
    }
}
