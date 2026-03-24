<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $masterEmail = 'suporte@creativeprintjp.com';

        // Garante que o usuário com este e-mail seja admin master
        DB::table('users')
            ->where('email', $masterEmail)
            ->update([
                'role' => 'admin',
                'active' => true,
                'tenant_id' => null, // Super Admin não deve estar vinculado a um tenant
                'updated_at' => now()
            ]);

        \Illuminate\Support\Facades\Log::info("Reparo de Super Admin: Permissões de 'admin' forçadas para {$masterEmail}");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
