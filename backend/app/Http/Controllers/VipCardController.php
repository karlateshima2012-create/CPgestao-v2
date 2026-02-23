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
        // Ignorar escopo global pois usuários públicos/deslogados podem acessar
        $card = LoyaltyCard::withoutGlobalScopes()->where('uid', $uid)->where('type', 'premium')->first();

        if (!$card) {
            return ApiResponse::error('Cartão não encontrado.', 'CARD_NOT_FOUND', 404);
        }

        if (!$tenant || !$tenant->active) {
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
            if ($isOwner) {
                return ApiResponse::ok([
                    'is_owner' => true,
                    'is_unlinked' => true,
                    'card_uid' => $card->uid,
                    'tenant' => [
                        'name' => $tenant->name
                    ]
                ]);
            } else {
                return ApiResponse::error('Este cartão não está vinculado a um cliente.', 'NOT_LINKED', 400);
            }
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
        ]);
    }

    public function addPoint(Request $request, $uid)
    {
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
            $pointsToAdd = $loyalty ? ($loyalty->vip_points_per_scan ?? 2) : 2;

            $requestRecord = $this->createPointRequest([
                'tenant_id' => $tenant->id,
                'customer_id' => $customer->id,
                'phone' => $customer->phone,
                'device_id' => null,
                'source' => 'nfc_scan_classic', // Identificador da origem
                'status' => 'pending',
                'requested_points' => $pointsToAdd,
                'meta' => ['is_nfc_scan' => true]
            ]);

            // Auto-aprova pois é o lojista quem está encostando o cartão
            $this->pointRequestService->applyPoints($requestRecord);
            $requestRecord->update(['status' => 'auto_approved', 'approved_at' => now()]);
            
            $customer->update(['last_activity_at' => now()]);
            
            $newBalance = $customer->fresh()->points_balance;
            
            $msg = "+ {$pointsToAdd} pontos computados com sucesso!";
            if ($newBalance >= $tenant->points_goal) {
                $msg .= " 🎉 A meta foi atingida!";
            }
            
            return ApiResponse::ok([
                'points_earned' => $pointsToAdd,
                'new_balance' => $newBalance,
                'message' => $msg
            ]);
        });
    }

    protected function createPointRequest(array $data)
    {
        return \App\Models\PointRequest::create($data);
    }
}
