<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use App\Models\Tenant;
use App\Models\User;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Buscar todos os Tenants
        $tenants = Tenant::all();

        foreach ($tenants as $tenant) {
            $tenantEmail = $tenant->email;

            // 2. Buscar usuários "client" deste tenant que estão com e-mail diferente
            $usersToSync = User::where('tenant_id', $tenant->id)
                ->where('role', 'client')
                ->where('email', '!=', $tenantEmail)
                ->get();

            foreach ($usersToSync as $user) {
                $oldEmail = $user->email;
                
                // 3. Atualizar e-mail do usuário para bater com o da loja
                $user->email = $tenantEmail;
                $user->save();

                // 4. Invalidar sessões antigas por segurança
                $user->tokens()->delete();

                \Illuminate\Support\Facades\Log::info("Reparo de Sincronização: Usuário do tenant {$tenant->id} atualizado de {$oldEmail} para {$tenantEmail}");
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Operação de reparo não reversível via migração (destrutiva por natureza de sincronização)
    }
};
