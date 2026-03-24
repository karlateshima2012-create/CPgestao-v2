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
        // Forçar a atualização das credenciais do Admin Master no banco de dados de produção
        $oldMasterAdmin = 'admin@creativeprint.com';
        $newMasterAdmin = 'suporte@creativeprintjp.com';
        $newMasterPass  = 'CPgestaoCRM23%';

        // 1. Verificar se o Administrador existe (pelo antigo ou novo e-mail)
        $admin = DB::table('users')
            ->where(function ($query) use ($oldMasterAdmin, $newMasterAdmin) {
                $query->where('email', $oldMasterAdmin)
                      ->orWhere('email', $newMasterAdmin);
            })
            ->where('role', 'admin')
            ->first();

        if ($admin) {
            DB::table('users')
                ->where('id', $admin->id)
                ->update([
                    'email' => $newMasterAdmin,
                    'password' => Hash::make($newMasterPass),
                    'must_change_password' => true,
                    'name' => 'Admin Master CP Gestão',
                    'updated_at' => now()
                ]);
        } else {
            // Caso por algum motivo bizarro ele não exista, criamos o padrão seguro
            DB::table('users')->insert([
                'id' => \Illuminate\Support\Str::uuid(),
                'name' => 'Admin Master CP Gestão',
                'email' => $newMasterAdmin,
                'password' => Hash::make($newMasterPass),
                'role' => 'admin',
                'must_change_password' => true,
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
