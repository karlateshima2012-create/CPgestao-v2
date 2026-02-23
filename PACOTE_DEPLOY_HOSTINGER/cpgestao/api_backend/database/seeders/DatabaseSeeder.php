<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Tenant;
use App\Models\TenantSetting;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // 1. Admin User
        $admin = User::firstOrCreate(
            ['email' => 'admin@creativeprint.com'],
            [
                'name' => 'Admin Master',
                'password' => Hash::make('admin123'),
                'role' => 'admin',
            ]
        );

        // 2. Tenant "Loja A"
        $tenant = Tenant::firstOrCreate(
            ['slug' => 'loja-a'],
            [
                'name' => 'Loja A',
                'email' => 'loja-a@teste.com',
                'plan' => 'Premium',
                'status' => 'active',
                'loyalty_active' => true,
                'points_goal' => 10,
                'reward_text' => '1 Café Grátis',
            ]
        );

        TenantSetting::firstOrCreate(
            ['tenant_id' => $tenant->id],
            [
                'pin_hash' => Hash::make('1234'),
                'pin_updated_at' => now(),
            ]
        );

        // 3. Client User (Tenant A)
        $client = User::firstOrCreate(
            ['email' => 'dono-a@loja.com'],
            [
                'name' => 'Dono Loja A',
                'password' => Hash::make('loja123'),
                'tenant_id' => $tenant->id,
                'role' => 'client',
            ]
        );

        // 4. Customer (Tenant A)
        $customer = \App\Models\Customer::firstOrCreate(
            ['phone' => '5511999999999', 'tenant_id' => $tenant->id],
            [
                'name' => 'João Silva',
                'email' => 'joao@email.com',
                'points_balance' => 5,
                'is_premium' => false,
            ]
        );

        // 5. Premium Batch (Tenant A)
        $batch = \App\Models\DeviceBatch::firstOrCreate(
            ['tenant_id' => $tenant->id, 'label' => 'Lote Inicial Premium'],
            ['quantity' => 3]
        );

        $uids = ['123456781234', '876543218765', '111122223333'];
        foreach ($uids as $uid) {
            \App\Models\Device::updateOrCreate(
                ['uid' => $uid],
                [
                    'tenant_id' => $tenant->id,
                    'batch_id' => $batch->id,
                    'type' => 'premium',
                    'status' => 'assigned',
                    'active' => true
                ]
            );
        }

        // 6. Totem Device (Tenant A)
        $totemUid = 'TOTEM-001';
        \App\Models\Device::updateOrCreate(
            ['uid' => $totemUid],
            [
                'tenant_id' => $tenant->id,
                'type' => 'totem',
                'status' => 'assigned',
                'active' => true
            ]
        );

        // Output information for documentation
        $this->command->info('----------------------------------------');
        $this->command->info('SEED COMPLETED SUCCESSFULLY');
        $this->command->info('----------------------------------------');
        $this->command->info('ADMIN_EMAIL: admin@creativeprint.com');
        $this->command->info('ADMIN_PASSWORD: admin123');
        $this->command->info('CLIENT_EMAIL: dono-a@loja.com');
        $this->command->info('CLIENT_PASSWORD: loja123');
        $this->command->info('TENANT_ID: ' . $tenant->id);
        $this->command->info('TERMINAL_SLUG: ' . $tenant->slug);
        $this->command->info('PREMIUM_UID_EXEMPLO: 123456781234');
        $this->command->info('TOTEM_UID_EXEMPLO: ' . $totemUid);
        $this->command->info('----------------------------------------');
    }
}
