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
        $card = LoyaltyCard::withoutGlobalScopes()->where('uid', $uid)->where('type', 'premium')->first();

        if (!$card) {
            return ApiResponse::error('Cartão não encontrado.', 'CARD_NOT_FOUND', 404);
        }

        $tenant = $card->tenant;
        if (!$tenant || $tenant->status !== "active") {
            return ApiResponse::error('Loja indisponível.', 'TENANT_INACTIVE', 403);
        }

        $isOwner = false;
        if (auth('sanctum')->check()) {
            $user = auth('sanctum')->user();
            if ($user && $user->role === 'client' && $user->tenant_id === $tenant->id) {
                $isOwner = true;
            }
        }

        if (!$card->linked_customer_id) {
            return ApiResponse::ok([
                'is_owner' => $isOwner,
                'is_unlinked' => true,
                'card_uid' => $card->uid,
                'tenant' => [
                    'name' => $tenant->name
                ]
            ]);
        }

        $card->load('customer', 'tenant');
        $customer = $card->customer;

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
            ],
            'goal' => $tenant->points_goal,
            'card_uid' => $card->uid,
            'points_to_add' => $this->calculatePointsToAdd($customer, $tenant)
        ]);
    }

    protected function calculatePointsToAdd($customer, $tenant)
    {
        $loyalty = $tenant->loyaltySettings;
        $levelIndex = max(0, ($customer->loyalty_level ?? 1) - 1);
        $levelsConfig = $loyalty ? $loyalty->levels_config : null;

        if (is_array($levelsConfig) && isset($levelsConfig[$levelIndex]) && isset($levelsConfig[$levelIndex]['points_per_visit'])) {
            return (int) $levelsConfig[$levelIndex]['points_per_visit'];
        }
        return $loyalty ? ($loyalty->vip_points_per_scan ?? 1) : 1;
    }

    public function addPoint(Request $request, $uid)
    {
        $uid = trim($uid);
        // Rota protegida auth:sanctum & role:client. BelongsToTenant ativo automaticamente.
        $card = LoyaltyCard::where('uid', $uid)->where('type', 'premium')->first();

        if (!$card) {
            return ApiResponse::error('Cartão não encontrado ou não pertence a esta loja.', 'CARD_NOT_FOUND', 404);
        }

        if (!$card->linked_customer_id) {
            return ApiResponse::error('Cartão não vinculado a nenhum cliente.', 'NOT_LINKED', 400);
        }

        return DB::transaction(function () use ($card) {
            $customer = $card->customer;
            $tenant = $card->tenant;
            
            $loyalty = $tenant->loyaltySettings;
            $pointsToAdd = 1;

            $pointsToAdd = $this->calculatePointsToAdd($customer, $tenant);

            $requestRecord = $this->createPointRequest([
                'tenant_id' => $tenant->id,
                'customer_id' => $customer->id,
                'phone' => $customer->phone,
                'device_id' => null,
                'source' => 'nfc_scan', 
                'status' => 'pending',
                'requested_points' => $pointsToAdd,
                'meta' => ['is_nfc_scan' => true]
            ]);

            $isElite = (strtolower($tenant->plan) === 'elite');
            
            if ($isElite) {
                // Elite matches Requirement 3: Auto-credit without Telegram
                $this->pointRequestService->applyPoints($requestRecord);
                $requestRecord->update(['status' => 'auto_approved', 'approved_at' => now()]);
                
                event(new \App\Events\PointRequestStatusUpdated($requestRecord));

                $customer->update(['last_activity_at' => now()]);
                $newBalance = $customer->fresh()->points_balance;
                
                return ApiResponse::ok([
                    'points_earned' => $pointsToAdd,
                    'new_balance' => $newBalance,
                    'message' => "+ {$pointsToAdd} pontos computados com sucesso!",
                    'auto_approved' => true
                ]);
            } else {
                // Classic/Pro follows Requirement 2: Send Telegram Inline Keyboard
                $settings = \App\Models\TenantSetting::where('tenant_id', $tenant->id)->first();
                $chatId = $settings ? $settings->telegram_chat_id : null;

                if ($chatId) {
                    $escName = TelegramService::escapeMarkdownV2($customer->name);
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
                    // Fallback to auto-approve if no telegram set? 
                    // Actually, the requirement says it MUST use telegram. 
                    // But if they haven't set it up, let's at least not break the flow or inform them.
                    return ApiResponse::error('ID de Notificação Telegram não configurado.', 'TELEGRAM_NOT_CONFIGURED', 400);
                }
            }
        });
    }

    protected function createPointRequest(array $data)
    {
        return \App\Models\PointRequest::create($data);
    }
}
