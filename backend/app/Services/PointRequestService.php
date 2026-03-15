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
            $isVisit = $request instanceof \App\Models\Visit;
            $pointsToAddRaw = $isVisit ? $request->points_granted : $request->requested_points;
            $isRedemption = $meta['is_redemption'] ?? false;

            if ($isRedemption) {
                $goal = $meta['goal'] ?? 0;

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
                
                // Flag for frontend notification
                $prefs = $customer->preferences ?? [];
                $prefs['pending_level_up_announcement'] = true;
                $customer->preferences = $prefs;
                
                $customer->save();

                $source = $isVisit ? $request->origin : $request->source;

                // Log Redemption Movement
                PointMovement::create([
                    'tenant_id' => $request->tenant_id,
                    'customer_id' => $customer->id,
                    'type' => 'redeem',
                    'points' => -$goal,
                    'origin' => $source,
                    'device_id' => ($request instanceof \App\Models\PointRequest) ? $request->device_id : null,
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
                    'device_id' => ($request instanceof \App\Models\PointRequest) ? $request->device_id : null,
                    'description' => 'Pontos da visita (Resgate) via: ' . $request->id,
                    'meta' => [
                        'request_id' => $request->id,
                    ]
                ]);
            } else {
                // Simple Credit
                $customer->increment('points_balance', $pointsToAddRaw);
                
                // Only increment attendance if it's NOT a manual adjustment or removal
                $isAdjustment = in_array($isVisit ? $request->origin : $request->source, ['ajuste_manual', 'correcao', 'extra']);
                
                if (!$isAdjustment) {
                    $customer->increment('attendance_count');
                }
                
                $customer->update(['last_activity_at' => now()]);

                $source = $isVisit ? $request->origin : $request->source;

                PointMovement::create([
                    'tenant_id' => $request->tenant_id,
                    'customer_id' => $customer->id,
                    'type' => $isAdjustment ? 'adjustment' : 'earn',
                    'points' => $pointsToAddRaw,
                    'origin' => $source,
                    'device_id' => ($request instanceof \App\Models\PointRequest) ? $request->device_id : null,
                    'description' => $isAdjustment ? 'Ajuste manual de pontos via: ' . $request->id : 'Pontos creditados via: ' . $request->id,
                    'meta' => [
                        'request_id' => $request->id,
                        'reason' => $meta['reason'] ?? null
                    ]
                ]);
            }

            return true;
        });
    }
}
