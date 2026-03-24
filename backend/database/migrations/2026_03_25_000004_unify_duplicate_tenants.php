<?php

use Illuminate\Database\Migrations\Migration;
use App\Models\Tenant;
use App\Models\Customer;
use App\Models\Device;
use App\Models\PointMovement;
use App\Models\Visit;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Unificar Garagem Lata Velha
        $this->mergeTenants('garagem-lata-velha', 'garagem-lata-velha-1');

        // 2. Unificar Bia Biju (se houver duplicidade com -1 ou similar)
        // Check for common suffixes
        $this->mergeTenants('bia-biju', 'bia-biju-1');
        
        \Illuminate\Support\Facades\Log::info("UNIFICATION: Processo de unificação de tenants concluído.");
    }

    private function mergeTenants($mainSlug, $duplicateSlug)
    {
        $main = Tenant::where('slug', $mainSlug)->first();
        $duplicate = Tenant::where('slug', $duplicateSlug)->first();

        if ($main && $duplicate && $main->id !== $duplicate->id) {
            \Illuminate\Support\Facades\Log::info("MERGE: Unificando {$duplicateSlug} ({$duplicate->id}) para {$mainSlug} ({$main->id})");

            // Mover Clientes
            $customersCount = Customer::withoutGlobalScopes()->where('tenant_id', $duplicate->id)->update(['tenant_id' => $main->id]);
            \Illuminate\Support\Facades\Log::info("MERGE: {$customersCount} clientes movidos.");

            // Mover Totens/Devices
            $devicesCount = Device::withoutGlobalScopes()->where('tenant_id', $duplicate->id)->update(['tenant_id' => $main->id]);
            \Illuminate\Support\Facades\Log::info("MERGE: {$devicesCount} totens movidos.");

            // Mover Movimentações de Pontos
            $movementsCount = PointMovement::withoutGlobalScopes()->where('tenant_id', $duplicate->id)->update(['tenant_id' => $main->id]);
            \Illuminate\Support\Facades\Log::info("MERGE: {$movementsCount} movimentações movidas.");

            // Mover Visitas
            $visitsCount = Visit::withoutGlobalScopes()->where('tenant_id', $duplicate->id)->update(['tenant_id' => $main->id]);
            \Illuminate\Support\Facades\Log::info("MERGE: {$visitsCount} visitas movidas.");

            // Apagar o tenant duplicado
            $duplicate->delete();
            \Illuminate\Support\Facades\Log::info("MERGE: Tenant duplicado {$duplicateSlug} apagado.");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
