<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Customer;
use App\Models\Device;
use App\Models\DeviceBatch;
use App\Models\LoyaltySetting;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class SystemTestSeeder extends Seeder
{
    public function run()
    {
        // 1. Criar Super Admin se não existir
        if (!User::where('role', 'admin')->exists()) {
            User::create([
                'name' => 'Super Admin',
                'email' => 'suporte@creativeprintjp.com',
                'password' => Hash::make('CPgestaoCRM23%'),
                'role' => 'admin',
                'onboarding_completed' => true,
            ]);
        }

        // --- CASO 1: LOJA SUCESSO & NORMAL ---
        $lojaNormal = $this->createTenant(
            'Loja Normal Sucesso',
            'loja-normal',
            'Business',
            now()->addMonths(6),
            true
        );
        $this->createOwner($lojaNormal, 'dono-normal@test.com');
        $this->seedCustomers($lojaNormal, 50); // Para testar paginação
        $this->seedNfcDevices($lojaNormal, 10, 3); // Lote de 10, 3 vinculados

        // --- CASO 2: QUASE NO LIMITE (Uso > 80%) ---
        $lojaQuase = $this->createTenant(
            'Loja Quase Limite',
            'loja-quase-limite',
            'Start',
            now()->addMonths(3),
            true
        );
        $this->createOwner($lojaQuase, 'dono-quase@test.com');
        $this->seedCustomers($lojaQuase, 1995); // Limite Start é 2000

        // --- CASO 3: LIMITE ATINGIDO ---
        $lojaLimite = $this->createTenant(
            'Loja Limite Atingido',
            'loja-atingiu-limite',
            'Start',
            now()->addMonths(3),
            true
        );
        $this->createOwner($lojaLimite, 'dono-limite@test.com');
        $this->seedCustomers($lojaLimite, 2000);

        // --- CASO 4: PLANO EXPIRADO ---
        $lojaExpirada = $this->createTenant(
            'Loja Plano Expirado',
            'loja-expirada',
            'Pro',
            now()->subDays(2),
            true
        );
        $this->createOwner($lojaExpirada, 'dono-expirado@test.com');
        $this->seedCustomers($lojaExpirada, 10);

        // --- CASO 5: CRM SUSPENSO / DESATIVADO ---
        $lojaSuspensa = $this->createTenant(
            'Loja Suspensa Admin',
            'loja-suspensa',
            'Pro',
            now()->addMonths(6),
            'suspended' // status = suspended
        );
        $this->createOwner($lojaSuspensa, 'dono-suspenso@test.com');
    }

    private function createTenant($name, $slug, $plan, $expires, $status = 'active')
    {
        // Limpeza agressiva para garantir estado limpo
        $old = Tenant::where('slug', $slug)->first();
        if ($old) {
            User::where('tenant_id', $old->id)->delete();
            Device::where('tenant_id', $old->id)->delete();
            DeviceBatch::where('tenant_id', $old->id)->delete();
            Customer::where('tenant_id', $old->id)->delete();
            LoyaltySetting::where('tenant_id', $old->id)->delete();
            \App\Models\TenantSetting::where('tenant_id', $old->id)->delete();
            $old->delete();
        }

        $tenant = Tenant::create([
            'name' => $name,
            'slug' => $slug,
            'email' => "contato@$slug.com",
            'owner_name' => "Proprietário $name",
            'phone' => '090-0000-' . str_pad(rand(0, 9999), 4, '0', STR_PAD_LEFT),
            'plan' => $plan,
            'plan_expires_at' => $expires,
            'status' => $status,
            'points_goal' => 10,
            'reward_text' => 'Brinde Especial',
        ]);

        \App\Models\TenantSetting::create([
            'tenant_id' => $tenant->id,
            'pin' => '1234',
            'pin_hash' => Hash::make('1234'),
            'pin_updated_at' => now(),
        ]);

        LoyaltySetting::create([
            'tenant_id' => $tenant->id,
            'regular_points_per_scan' => 1,
            'vip_points_per_scan' => 2,
        ]);

        return $tenant;
    }

    private function createOwner($tenant, $email)
    {
        User::create([
            'name' => "Dono " . $tenant->name,
            'email' => $email,
            'password' => Hash::make('Test1234!'),
            'role' => 'client',
            'tenant_id' => $tenant->id,
            'onboarding_completed' => true,
        ]);
    }

    private function seedCustomers($tenant, $count)
    {
        $customers = [];
        for ($i = 1; $i <= $count; $i++) {
            $customers[] = [
                'id' => Str::uuid(),
                'tenant_id' => $tenant->id,
                'name' => "Cliente $i " . $tenant->slug,
                'phone' => '080' . str_pad($i, 8, '0', STR_PAD_LEFT),
                'city' => 'Test City',
                'points_balance' => rand(0, 9),
                'created_at' => now(),
                'updated_at' => now(),
            ];

            // Inserir em chunks de 500 para performance
            if (count($customers) >= 500) {
                Customer::insert($customers);
                $customers = [];
            }
        }
        if (count($customers) > 0) {
            Customer::insert($customers);
        }
    }

    private function seedNfcDevices($tenant, $totalBatch, $linkedCount)
    {
        $batch = DeviceBatch::create([
            'tenant_id' => $tenant->id,
            'quantity' => $totalBatch,
            'batch_number' => 1,
        ]);

        for ($i = 1; $i <= $totalBatch; $i++) {
            $uid = str_pad($i, 12, '0', STR_PAD_LEFT);
            $customer = null;
            if ($i <= $linkedCount) {
                $customer = Customer::where('tenant_id', $tenant->id)->skip($i-1)->first();
            }

            Device::create([
                'tenant_id' => $tenant->id,
                'batch_id' => $batch->id,
                'uid' => $uid,
                'type' => 'premium',
                'status' => $customer ? 'linked' : 'assigned',
                'linked_customer_id' => $customer ? $customer->id : null,
            ]);
            
            if ($customer) {
                $customer->update(['is_premium' => true]);
            }
        }
    }
}
