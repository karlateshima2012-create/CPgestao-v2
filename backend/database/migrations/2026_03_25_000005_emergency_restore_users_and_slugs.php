<?php

use Illuminate\Database\Migrations\Migration;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Restaurar o slug 'garagem-lata-velha-1' como o principal se o usuário deseja mantê-lo
        // Ou melhor, vamos garantir que existam os dois caminhos se possível, mas o banco só aceita um slug.
        // O usuário disse que o dashboard mostra '-1', então 'garagem-lata-velha-1' deve ser o principal.
        
        $main = Tenant::where('slug', 'garagem-lata-velha')->first();
        $dup = Tenant::where('slug', 'garagem-lata-velha-1')->first();

        if ($main && !$dup) {
            // Se o unificador apagou o -1 e sobrou o limpo, vamos renomear de volta para -1 
            // para não quebrar os links físicos do cliente.
            $main->slug = 'garagem-lata-velha-1';
            $main->save();
            \Illuminate\Support\Facades\Log::info("EMERGENCY: Slug restaurado para garagem-lata-velha-1");
        }

        // 2. VINCULAR USUÁRIOS
        // Buscar usuários que ficaram órfãos (com tenant_id que não existe mais) ou que pertenciam ao principal antigo
        // Como não sabemos a ID do deletado, vamos buscar pelo e-mail do lojista
        $tenant = Tenant::where('slug', 'garagem-lata-velha-1')->first();
        if ($tenant) {
            User::where('email', 'latavelha@icloud.com')->update(['tenant_id' => $tenant->id, 'role' => 'client']);
            \Illuminate\Support\Facades\Log::info("EMERGENCY: Usuário latavelha vinculado ao tenant {$tenant->id}");
        }

        // 3. Reparo para Bia Biju
        $bia = Tenant::where('slug', 'bia-biju')->first();
        if ($bia) {
             User::where('email', 'karla.teshima.2012@gmail.com')->update(['tenant_id' => $bia->id, 'role' => 'client']);
             \Illuminate\Support\Facades\Log::info("EMERGENCY: Usuário Bia Biju vinculado ao tenant {$bia->id}");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
