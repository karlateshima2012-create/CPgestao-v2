<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Tenant;
use App\Models\Device;
use App\Models\Visit;
use App\Http\Responses\ApiResponse;

use App\Services\TelegramService;
use App\Jobs\SendTelegramNotificationJob;

class PointEngineService
{
    /**
     * Process potential point earning and handle 'Next Visit Reward' logic.
     * 
     * @return \App\Http\Responses\ApiResponse|null Returns a response if EARN is blocked, null if it can proceed.
     */
    public function checkRewardBlocking(Customer $customer, Tenant $tenant, ?Device $device = null, ?string $token = null, $levelsConfig = null)
    {
        $currentLevel = $customer->loyalty_level ?? 1;
        $goal = $tenant->points_goal;

        if (is_array($levelsConfig)) {
            $lvlIdx = max(0, (int)$currentLevel - 1);
            if (isset($levelsConfig[$lvlIdx]) && isset($levelsConfig[$lvlIdx]['goal'])) {
                $goal = (int) $levelsConfig[$lvlIdx]['goal'];
            }
        }

        // CRITICAL BUSINESS RULE: If balance >= goal, block earning and set to reward_pending
        if ($customer->points_balance >= $goal) {
            $visit = Visit::create([
                'tenant_id' => $tenant->id,
                'customer_id' => $customer->id,
                'customer_name' => $customer->name,
                'customer_phone' => $customer->phone,
                'visit_at' => now(),
                'origin' => $token ? 'nfc' : ($device ? 'qr' : 'manual'),
                'plan_type' => $tenant->plan,
                'status' => 'reward_pending',
                'points_granted' => 0,
                'device_id' => $device ? $device->id : null
            ]);

            $customerNameEscaped = TelegramService::escapeMarkdownV2($customer->name);
            $msg = "🏆 *RESGATE PENDENTE* 🏆\n"
                 . "O cliente *{$customerNameEscaped}* já atingiu a meta e aguarda o prêmio\.\n\n"
                 . "Clique abaixo para entregar a recompensa e reiniciar o ciclo:";

            $markup = [
                'inline_keyboard' => [
                    [
                        ['text' => '🎁 ENTREGAR PRÊMIO', 'callback_data' => "redeem_reward:{$customer->id}"]
                    ]
                ]
            ];

            SendTelegramNotificationJob::dispatch($tenant->id, $msg, 'visit', $markup);

            return ApiResponse::ok([
                'request_id' => null,
                'customer_name' => $customer->name,
                'points_earned' => 0,
                'new_balance' => $customer->points_balance,
                'loyalty_level' => $customer->loyalty_level,
                'loyalty_level_name' => $customer->loyalty_level_name,
                'points_goal' => $goal,
                'message' => "Você atingiu a meta de {$goal} pontos! Pode resgatar seu prêmio. Você não pode pontuar até reiniciar no próximo nível.",
                'auto_approved' => false,
                'is_reward_ready' => true
            ]);
        }

        return null;
    }
}
