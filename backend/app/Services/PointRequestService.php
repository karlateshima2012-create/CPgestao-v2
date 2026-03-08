<?php

namespace App\Services;

use App\Models\PointRequest;
use App\Models\PointMovement;
use App\Models\Customer;
use Illuminate\Support\Facades\DB;

class PointRequestService
{
    /**
     * Apply points/redemption from a PointRequest or Visit to a Customer.
     */
    public function applyPoints($request)
    {
        return DB::transaction(function () use ($request) {
            $customer = Customer::withoutGlobalScopes()->findOrFail($request->customer_id);
            $meta = $request->meta ?? [];
            $pointsToAddRaw = (get_class($request) === 'App\Models\Visit') ? $request->points_granted : $request->requested_points;
            $isRedemption = $meta['is_redemption'] ?? false;

            if ($isRedemption) {
                $goal = $meta['goal'] ?? 0;
                $pointsToAddRaw = (get_class($request) === 'App\Models\Visit') ? $request->points_granted : $request->requested_points;

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
                // New Balance = (Remaining from previous level) + visit points + new level initial bonus
                $customer->points_balance = ($customer->points_balance - $goal) + $pointsToAddRaw + $initialLevelPoints;
                $customer->loyalty_level = $nextLevel;
                $customer->attendance_count = ($customer->attendance_count ?? 0) + 1;
                $customer->last_activity_at = now();
                $customer->save();

                $source = (get_class($request) === 'App\Models\Visit') ? $request->origin : $request->source;

                // Log Redemption Movement
                PointMovement::create([
                    'tenant_id' => $request->tenant_id,
                    'customer_id' => $customer->id,
                    'type' => 'redeem',
                    'points' => -$goal,
                    'origin' => $source,
                    'device_id' => (get_class($request) === 'App\Models\PointRequest') ? $request->device_id : null,
                    'description' => 'Resgate de prêmio via: ' . $request->id,
                    'meta' => [
                        'request_id' => $request->id,
                        'goal' => $goal,
                        'new_level' => $customer->loyalty_level,
                    ]
                ]);

                // Log Earn Movement
                PointMovement::create([
                    'tenant_id' => $request->tenant_id,
                    'customer_id' => $customer->id,
                    'type' => 'earn',
                    'points' => $pointsToAddRaw,
                    'origin' => $source,
                    'device_id' => (get_class($request) === 'App\Models\PointRequest') ? $request->device_id : null,
                    'description' => 'Pontos da visita (Resgate) via: ' . $request->id,
                    'meta' => [
                        'request_id' => $request->id,
                        'bonus_applied' => $bonus,
                    ]
                ]);
            } else {
                // Simple Credit
                $customer->increment('points_balance', $pointsToAddRaw);
                $customer->increment('attendance_count');
                $customer->update(['last_activity_at' => now()]);

                $source = (get_class($request) === 'App\Models\Visit') ? $request->origin : $request->source;

                PointMovement::create([
                    'tenant_id' => $request->tenant_id,
                    'customer_id' => $customer->id,
                    'type' => 'earn',
                    'points' => $pointsToAddRaw,
                    'origin' => $source,
                    'device_id' => (get_class($request) === 'App\Models\PointRequest') ? $request->device_id : null,
                    'description' => 'Pontos creditados via: ' . $request->id,
                    'meta' => [
                        'request_id' => $request->id,
                    ]
                ]);
            }

            return true;
        });
    }
}
