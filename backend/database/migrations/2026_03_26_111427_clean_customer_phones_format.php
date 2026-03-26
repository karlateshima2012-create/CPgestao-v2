<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use App\Utils\PhoneHelper;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 0. Corrigir bloqueador de índices duplicados de migrações anteriores
        try {
            Schema::table('customers', function (Blueprint $table) {
                // Drop if exists (Safety for old broken migrations)
                $table->dropIndex('customers_tenant_id_created_at_index');
            });
        } catch (\Exception $e) {
            // Ignore if index doesn't exist
        }

        // 1. Limpar e padronizar todos os telefones existentes

        DB::table('customers')->get()->each(function ($customer) {
            if ($customer->phone) {
                $normalized = PhoneHelper::normalize($customer->phone);
                if ($normalized !== $customer->phone) {
                    DB::table('customers')
                        ->where('id', $customer->id)
                        ->update(['phone' => $normalized]);
                }
            }
        });

        // 2. Tentar adicionar o índice único (pode falhar se houver duplicatas reais)
        try {
            Schema::table('customers', function (Blueprint $table) {
                // Remove duplicates if any (keep latest)
                $duplicates = DB::table('customers')
                    ->select('tenant_id', 'phone', DB::raw('count(*) as total'))
                    ->groupBy('tenant_id', 'phone')
                    ->having('total', '>', 1)
                    ->get();

                foreach ($duplicates as $duplicate) {
                    $ids = DB::table('customers')
                        ->where('tenant_id', $duplicate->tenant_id)
                        ->where('phone', $duplicate->phone)
                        ->orderBy('updated_at', 'desc')
                        ->pluck('id');
                    
                    // Keep the first (latest), delete others
                    $ids->shift();
                    DB::table('customers')->whereIn('id', $ids)->delete();
                }

                $table->unique(['tenant_id', 'phone'], 'customers_tenant_phone_unique');
            });
        } catch (\Exception $e) {
            // Log if unique index fails, but don't stop migration
            \Illuminate\Support\Facades\Log::warning("Could not add unique index to customers: " . $e->getMessage());
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropUnique('customers_tenant_phone_unique');
        });
    }
};
