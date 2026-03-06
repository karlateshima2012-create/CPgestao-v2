<?php

namespace Database\Seeders;

use App\Models\Plan;
use App\Models\PlanFeature;
use Illuminate\Database\Seeder;

class PlanSeeder extends Seeder
{
    public function run(): void
    {
        $plans = [
            [
                'name' => '🔵 Plano PRO',
                'slug' => 'pro',
                'description' => 'Fluxo QR Online com aprovação manual. Sem cartões físicos.',
                'features' => [
                    'contact_limit' => 4000,
                    'device_limit' => 3,
                    'user_limit' => 3,
                    'allow_auto_approve' => 0, // Requires owner approval
                    'allow_online_qr' => 1,
                    'telegram_enabled' => 1,
                    'nfc_cards_enabled' => 0,
                ]
            ],
            [
                'name' => '🟣 Plano ELITE',
                'slug' => 'elite',
                'description' => 'Check-in 100% automático via QR. Sem cartões físicos.',
                'features' => [
                    'contact_limit' => 6000,
                    'device_limit' => 999999,
                    'user_limit' => 999999,
                    'allow_auto_approve' => 1, // Fully automatic
                    'allow_online_qr' => 1,
                    'auto_checkin_full' => 1,
                    'reports_per_device' => 1,
                    'nfc_cards_enabled' => 0,
                    'advanced_logs' => 1,
                    'engagement_analytics' => 1,
                    'min_interval_minutes' => 360,
                ]
            ],
        ];

        foreach ($plans as $pData) {
            $plan = Plan::updateOrCreate(['slug' => $pData['slug']], [
                'name' => $pData['name'],
            ]);

            foreach ($pData['features'] as $slug => $value) {
                PlanFeature::updateOrCreate(
                    ['plan_id' => $plan->id, 'feature_slug' => $slug],
                    ['feature_value' => $value]
                );
            }
        }
    }
}
