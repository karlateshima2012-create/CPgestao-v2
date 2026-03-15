<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $settings = \App\Models\LoyaltySetting::all();
        foreach ($settings as $setting) {
            $levels = $setting->levels_config;
            if (is_array($levels)) {
                $updated = false;
                foreach ($levels as &$level) {
                    if (isset($level['name']) && $level['name'] === 'Diamante') {
                        if (isset($level['points_per_visit']) && (int)$level['points_per_visit'] === 4) {
                            $level['points_per_visit'] = 5;
                            $updated = true;
                        }
                    }
                }
                if ($updated) {
                    $setting->levels_config = $levels;
                    $setting->save();
                    // Limpar cache para garantir que o cliente veja a mudança imediatamente
                    cache()->forget("tenant_{$setting->tenant_id}_loyalty_levels");
                }
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $settings = \App\Models\LoyaltySetting::all();
        foreach ($settings as $setting) {
            $levels = $setting->levels_config;
            if (is_array($levels)) {
                $updated = false;
                foreach ($levels as &$level) {
                    if (isset($level['name']) && $level['name'] === 'Diamante') {
                        if (isset($level['points_per_visit']) && (int)$level['points_per_visit'] === 5) {
                            $level['points_per_visit'] = 4;
                            $updated = true;
                        }
                    }
                }
                if ($updated) {
                    $setting->levels_config = $levels;
                    $setting->save();
                    cache()->forget("tenant_{$setting->tenant_id}_loyalty_levels");
                }
            }
        }
    }
};
