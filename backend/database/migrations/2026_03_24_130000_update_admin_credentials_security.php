<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $oldMasterAdmin = 'admin@creativeprint.com';
        $newMasterAdmin = 'suporte@creativeprintjp.com';
        $newMasterPass  = 'CPgestaoCRM23%';

        // 1. Procurar o usuário atual (pelo e-mail antigo ou pelo e-mail novo se já existir)
        $admin = DB::table('users')
            ->where('email', $oldMasterAdmin)
            ->orWhere('email', $newMasterAdmin)
            ->first();

        if ($admin) {
            // Se ele já existe, atualizamos todos os dados para o novo padrão Master
            DB::table('users')
                ->where('id', $admin->id)
                ->update([
                    'email' => $newMasterAdmin,
                    'password' => Hash::make($newMasterPass),
                    'role' => 'admin', // Garante que ele tenha o papel de admin master
                    'must_change_password' => false, // Admin Master não precisa da tela de primeiro acesso
                    'active' => true,
                    'name' => 'Admin Master CP Gestão',
                    'updated_at' => now()
                ]);
        } else {
            // Se por acaso ele não existir em lugar nenhum, criamos do zero
            DB::table('users')->insert([
                'id' => \Illuminate\Support\Str::uuid(),
                'name' => 'Admin Master CP Gestão',
                'email' => $newMasterAdmin,
                'password' => Hash::make($newMasterPass),
                'role' => 'admin',
                'must_change_password' => false,
                'active' => true,
                'created_at' => now(),
                'updated_at' => now()
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Não revertemos por segurança de acesso
    }
};
