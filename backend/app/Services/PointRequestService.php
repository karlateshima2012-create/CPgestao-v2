<?php

namespace App\Services;

use App\Models\PointRequest;
use App\Models\PointMovement;
use App\Models\Customer;
use Illuminate\Support\Facades\DB;

class PointRequestService
{
    /**
     * Apply points/redemption from a PointRequest to a Customer.
     */
    public function applyPoints(PointRequest $request)
    {
        return DB::transaction(function () use ($request) {
            $customer = Customer::withoutGlobalScopes()->findOrFail($request->customer_id);
            $meta = $request->meta ?? [];
            $isRedemption = $meta['is_redemption'] ?? false;
            
            if ($isRedemption) {
                $goal = $meta['goal'] ?? 0;
                $bonus = $meta['bonus'] ?? 0;
                $pointsToAdd = $request->requested_points - $bonus;
                $vipInitial = $meta['vip_initial'] ?? 0;
                $wasPremium = $customer->is_premium;

                // Determine new level and any initial bonus for it
                $loyalty = \App\Models\LoyaltySetting::withoutGlobalScopes()->where('tenant_id', $request->tenant_id)->first();
                $initialLevelPoints = 0;
                $nextLevel = ($customer->loyalty_level ?? 1) + 1;
                
                if ($loyalty && is_array($loyalty->levels_config)) {
                    // level uses 1-based indexing in customer, so index is nextLevel - 1
                    $nextLevelIdx = $nextLevel - 1;
                    if (isset($loyalty->levels_config[$nextLevelIdx])) {
                        $initialLevelPoints = (int)($loyalty->levels_config[$nextLevelIdx]['initial_points'] ?? 0);
                    }
                }

                // Update customer state
                if (!$wasPremium) {
                    $customer->is_premium = true;
                }
                
                $appliedVipInitial = (!$wasPremium) ? $vipInitial : 0;
                // New Balance = (Remaining from previous level) + visit points + vip reward bonus + new level initial bonus
                $customer->points_balance = ($customer->points_balance - $goal) + $request->requested_points + $appliedVipInitial + $initialLevelPoints;
                $customer->loyalty_level = $nextLevel;
                $customer->last_activity_at = now();
                $customer->save();

                // Log Redemption Movement
                PointMovement::create([
                    'tenant_id' => $request->tenant_id,
                    'customer_id' => $customer->id,
                    'type' => 'redeem',
                    'points' => -$goal,
                    'origin' => $request->source,
                    'device_id' => $request->device_id,
                    'description' => 'Resgate de prêmio via solicitação: ' . $request->id,
                    'meta' => [
                        'point_request_id' => $request->id,
                        'goal' => $goal,
                        'new_level' => $customer->loyalty_level,
                    ]
                ]);

                // Log Earn Movement
                PointMovement::create([
                    'tenant_id' => $request->tenant_id,
                    'customer_id' => $customer->id,
                    'type' => 'earn',
                    'points' => $request->requested_points,
                    'origin' => $request->source,
                    'device_id' => $request->device_id,
                    'description' => 'Pontos da visita (Resgate) via solicitação: ' . $request->id,
                    'meta' => [
                        'point_request_id' => $request->id,
                        'bonus_applied' => $bonus,
                    ]
                ]);
            } else {
                // Simple Credit
                $customer->increment('points_balance', $request->requested_points);
                $customer->update(['last_activity_at' => now()]);

                PointMovement::create([
                    'tenant_id' => $request->tenant_id,
                    'customer_id' => $customer->id,
                    'type' => 'earn',
                    'points' => $request->requested_points,
                    'origin' => $request->source,
                    'device_id' => $request->device_id,
                    'description' => 'Pontos creditados via solicitação: ' . $request->id,
                    'meta' => json_encode([
                        'point_request_id' => $request->id,
                    ])
                ]);
            }

            return true;
        });
    }
}
