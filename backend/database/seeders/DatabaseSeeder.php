<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Tenant;
use App\Models\TenantSetting;
use App\Models\LoyaltySetting;
use App\Models\Customer;
use App\Models\PointRequest;
use App\Models\Device;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->command->info('🚀 Preparando ambiente de testes CPgestão-v2...');
        
        // Seed Plans first
        $this->call(PlanSeeder::class);

        // Limpar dados para evitar erros de duplicidade
        DB::statement('PRAGMA foreign_keys = OFF;');
        DB::table('point_requests')->delete();
        DB::table('point_movements')->delete();
        DB::table('customers')->delete();
        DB::table('users')->where('role', '!=', 'admin')->delete();
        DB::table('tenants')->delete();
        DB::statement('PRAGMA foreign_keys = ON;');

        // 1. ADMIN MASTER
        $adminEmail = 'admin@creativeprint.com';
        $adminPass = 'Admin1234!';
        User::updateOrCreate(
            ['email' => $adminEmail],
            [
                'name' => 'Admin Master',
                'password' => Hash::make($adminPass),
                'role' => 'admin',
                'active' => true,
            ]
        );

        // --- 1. CENÁRIO LOJA PRO (TESTE DE TELEGRAM E EXPANSÃO) ---
        $proPlan = \App\Models\Plan::where('slug', 'pro')->first();
        $proTenant = Tenant::updateOrCreate(
            ['slug' => 'burger-pro'],
            [
                'name' => 'Burger Pro',
                'owner_name' => 'Marina Pro',
                'phone' => '08099998888',
                'email' => 'pro@loja.com',
                'plan' => 'Pro',
                'plan_id' => $proPlan?->id,
                'extra_contacts_quota' => 1000, // Pack Bronze (+1000)
                'status' => 'active',
                'loyalty_active' => true,
                'points_goal' => 5,
                'reward_text' => 'Hambúrguer Gourmet',
            ]
        );
        TenantSetting::updateOrCreate(['tenant_id' => $proTenant->id], ['pin_hash' => Hash::make('1234')]);
        LoyaltySetting::updateOrCreate(['tenant_id' => $proTenant->id], ['points_goal' => 5]);
        User::updateOrCreate(['email' => 'login-pro@teste.com'], ['name' => 'Marina Pro', 'password' => Hash::make('senha123'), 'tenant_id' => $proTenant->id, 'role' => 'client', 'active' => true]);

        // Point Requests
        PointRequest::create(['tenant_id' => $proTenant->id, 'phone' => '09077776666', 'source' => 'online_qr', 'status' => 'pending', 'requested_points' => 1]);
        PointRequest::create(['tenant_id' => $proTenant->id, 'phone' => '08055554444', 'source' => 'online_qr', 'status' => 'pending', 'requested_points' => 1]);

        $this->command->info('⏳ Gerando base de 3.500 clientes para Burger Pro...');
        $this->generateCustomers($proTenant->id, 3500);

        // --- 2. CENÁRIO LOJA ELITE (TESTE DE AUTOMAÇÃO E ILIMITADO) ---
        $elitePlan = \App\Models\Plan::where('slug', 'elite')->first();
        $eliteTenant = Tenant::updateOrCreate(
            ['slug' => 'sushi-elite'],
            [
                'name' => 'Sushi Elite',
                'owner_name' => 'Tanaka Elite',
                'phone' => '07033332222',
                'email' => 'elite@loja.com',
                'plan' => 'Elite',
                'plan_id' => $elitePlan?->id,
                'extra_contacts_quota' => -1, // Infinity
                'status' => 'active',
                'loyalty_active' => true,
                'points_goal' => 20,
                'reward_text' => 'Ceviche Especial',
            ]
        );
        TenantSetting::updateOrCreate(['tenant_id' => $eliteTenant->id], ['pin_hash' => Hash::make('1234')]);
        // Configurar automação: Ponto de boas vindas
        LoyaltySetting::updateOrCreate(['tenant_id' => $eliteTenant->id], [
            'points_goal' => 20,
            'signup_bonus_points' => 1 // Ponto de boas-vindas
        ]);
        User::updateOrCreate(['email' => 'login-elite@teste.com'], ['name' => 'Tanaka Elite', 'password' => Hash::make('senha123'), 'tenant_id' => $eliteTenant->id, 'role' => 'client', 'active' => true]);

        $this->command->info('⏳ Gerando base de 6.500 clientes para Sushi Elite (Ilimitado)...');
        $this->generateCustomers($eliteTenant->id, 6500);

        // --- RELATÓRIO FINAL ---
        $this->printReport($adminEmail, $adminPass, $proTenant, $eliteTenant);
    }

    private function generateCustomers($tenantId, $count)
    {
        $batchSize = 500;
        for ($i = 0; $i < $count; $i += $batchSize) {
            $currentBatch = min($batchSize, $count - $i);
            $data = [];
            for ($j = 0; $j < $currentBatch; $j++) {
                $data[] = [
                    'id' => Str::uuid(),
                    'tenant_id' => $tenantId,
                    'name' => 'Cliente ' . ($i + $j + 10),
                    'phone' => '090' . str_pad($i + $j + 10, 8, '0', STR_PAD_LEFT),
                    'email' => 'cliente' . ($i + $j + 10) . '@teste.com',
                    'points_balance' => 0,
                    'created_at' => now(), 'updated_at' => now()
                ];
            }
            Customer::insert($data);
        }
    }

    private function printReport($adminEmail, $adminPass, $pro, $elite)
    {
        $baseUrl = 'http://localhost:5173'; // Ajustar se necessário para o ambiente
        
        $this->command->info("\n" . str_repeat('=', 60));
        $this->command->info('💎 RELATÓRIO DE AMBIENTE CPgestão-v2');
        $this->command->info(str_repeat('=', 60));

        $this->command->warn("\n🔑 ACESSO MASTER ADMIN:");
        $this->command->info("   Email: $adminEmail");
        $this->command->info("   Senha: $adminPass");

        $this->command->warn("\n🏪 ACESSOS LOJISTAS:");
        $this->command->info("   1. Pro:     login-pro@teste.com / senha123");
        $this->command->info("   2. Elite:   login-elite@teste.com / senha123");

        $this->command->warn("\n👥 ACESSOS CLIENTES FINAIS (PARA CONSULTAR SALDO):");
        $this->command->info("   - Pro:     09000000010 (0 Pontos)");
        $this->command->info("   - Elite:   09000000010 (0 Pontos)");

        $this->command->warn("\n🔗 LINKS PÁGINAS PÚBLICAS:");
        $this->command->info("   - Pro:     $baseUrl/p/{$pro->slug}");
        $this->command->info("   - Elite:   $baseUrl/p/{$elite->slug}");

        $this->command->info("\n" . str_repeat('=', 60));
        $this->command->info('✅ TUDO PRONTO PARA OS TESTES!');
        $this->command->info(str_repeat('=', 60) . "\n");
    }
}
