<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Models\LoyaltySetting;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $newConfigs = [
            ['name' => 'Bronze', 'goal' => 10, 'reward' => '', 'points_per_visit' => 1, 'points_per_signup' => 1, 'days_to_downgrade' => 0, 'active' => true],
            ['name' => 'Prata', 'goal' => 24, 'reward' => '', 'points_per_visit' => 2, 'points_per_signup' => 1, 'days_to_downgrade' => 30, 'active' => true],
            ['name' => 'Ouro', 'goal' => 45, 'reward' => '', 'points_per_visit' => 3, 'points_per_signup' => 1, 'days_to_downgrade' => 30, 'active' => true],
            ['name' => 'Diamante', 'goal' => 80, 'reward' => '', 'points_per_visit' => 5, 'points_per_signup' => 1, 'days_to_downgrade' => 30, 'active' => true]
        ];

        // Update all existing settings that are currently using the OLD defaults (10/20/30/50) or are null
        $settings = LoyaltySetting::all();
        foreach ($settings as $setting) {
            $current = $setting->levels_config;
            
            // If it's empty, or looks like the old default (Prata 20, Ouro 30, Diamante 50)
            if (!$current || (isset($current[1]) && $current[1]['goal'] == 20)) {
                
                // Keep the current Rewards if they exist
                $merged = $newConfigs;
                if ($current) {
                    foreach ($current as $idx => $lvl) {
                        if (isset($merged[$idx])) {
                            $merged[$idx]['reward'] = $lvl['reward'] ?? '';
                        }
                    }
                }

                $setting->levels_config = $merged;
                $setting->save();
                
                // Clear cache if any
                \Illuminate\Support\Facades\Cache::forget("tenant_{$setting->tenant_id}_loyalty_levels");
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No reversal needed, as this is a one-time data correction
    }
};
