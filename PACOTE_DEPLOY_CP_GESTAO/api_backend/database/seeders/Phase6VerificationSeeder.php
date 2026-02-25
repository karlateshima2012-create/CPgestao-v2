<?php

namespace Database\Seeders;

use App\Models\Tenant;
use App\Models\Device;
use App\Models\QrToken;
use App\Models\Plan;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class Phase6VerificationSeeder extends Seeder
{
    public function run()
    {
        // 1. Get or Create Elite Tenant
        $elitePlan = Plan::where('slug', 'elite')->first();
        if (!$elitePlan) {
            $this->command->error('Elite plan not found. Please run PlanSeeder first.');
            return;
        }

        $tenant = Tenant::firstOrCreate([
            'slug' => 'academia-elite'
        ], [
            'name' => 'Academia Elite',
            'email' => 'elite@academia.com',
            'plan' => 'Elite',
            'plan_id' => $elitePlan->id,
            'status' => 'active',
            'points_goal' => 10,
            'reward_text' => 'BCAA Grátis'
        ]);

        // Ensure features are loaded (min_interval_minutes should be there)
        $tenant->update(['plan_id' => $elitePlan->id]);

        // 2. Create Auto-Checkin Device
        Device::updateOrCreate([
            'tenant_id' => $tenant->id,
            'mode' => 'auto_checkin'
        ], [
            'name' => 'Entrada Principal',
            'nfc_uid' => 'checkin_001',
            'auto_approve' => true,
            'active' => true
        ]);

        // 3. Generate QR Tokens for Online Flow
        QrToken::updateOrCreate([
            'token' => 'VALID_TOKEN_123'
        ], [
            'tenant_id' => $tenant->id,
            'used' => false
        ]);

        QrToken::updateOrCreate([
            'token' => 'USED_TOKEN_456'
        ], [
            'tenant_id' => $tenant->id,
            'used' => true,
            'used_at' => now()->subDay()
        ]);

        $this->command->info('Phase 6 Verification Seeder finished.');
        $this->command->info('Tenant Slug: academia-elite');
        $this->command->info('Valid Token: VALID_TOKEN_123');
        $this->command->info('Device UID: checkin_001');
    }
}
