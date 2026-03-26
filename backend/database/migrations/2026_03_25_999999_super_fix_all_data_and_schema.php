<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Customer;
use App\Models\Device;
use App\Models\PointMovement;
use App\Models\Visit;

return new class extends Migration
{
    public function up(): void
    {
        // 1. SCHEMAS SYNCHRONIZATION
        
        // Fix visits table
        if (Schema::hasTable('visits')) {
            // Check if it's the old schema
            if (Schema::hasColumn('visits', 'user_id') && !Schema::hasColumn('visits', 'tenant_id')) {
                // Too old, just drop and recreate
                Schema::drop('visits');
            }
        }

        if (!Schema::hasTable('visits')) {
            Schema::create('visits', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('tenant_id')->index();
                $table->uuid('customer_id')->index();
                $table->uuid('device_id')->nullable()->index();
                $table->string('customer_name')->nullable();
                $table->string('customer_phone')->nullable();
                $table->string('customer_company')->nullable();
                $table->string('foto_perfil_url')->nullable();
                $table->dateTime('visit_at')->index();
                $table->string('origin');
                $table->string('plan_type')->nullable();
                $table->string('status')->index();
                $table->integer('points_granted')->default(0);
                $table->uuid('approved_by')->nullable();
                $table->dateTime('approved_at')->nullable();
                $table->json('meta')->nullable();
                $table->timestamps();
            });
        }

        // Fix customers table
        Schema::table('customers', function (Blueprint $table) {
            if (Schema::hasColumn('customers', 'photo_url') && !Schema::hasColumn('customers', 'foto_perfil_url')) {
                $table->renameColumn('photo_url', 'foto_perfil_url');
            }
            if (Schema::hasColumn('customers', 'company') && !Schema::hasColumn('customers', 'company_name')) {
                $table->renameColumn('company', 'company_name');
            }
            if (!Schema::hasColumn('customers', 'points_balance')) {
                $table->integer('points_balance')->default(0);
            }
            if (!Schema::hasColumn('customers', 'loyalty_level')) {
                $table->integer('loyalty_level')->default(1);
            }
            if (!Schema::hasColumn('customers', 'attendance_count')) {
                $table->integer('attendance_count')->default(0);
            }
        });

        // 2. DATA UNIFICATION (Tenants)
        $this->safeMerge('garagem-lata-velha', 'garagem-lata-velha-1');
        $this->safeMerge('bia-biju', 'bia-biju-elite'); // hypothetical duplicate
        
        // 3. SLUG RESTORATION (Ensures -1 exists for original users)
        $this->restoreSlug('garagem-lata-velha', 'garagem-lata-velha-1');

        // 4. FIX SUPER ADMIN
        $adminEmail = 'suporte@creativeprintjp.com';
        DB::table('users')
            ->where('email', $adminEmail)
            ->update(['role' => 'super_admin']);
    }


    private function safeMerge($mainSlug, $dupSlug)
    {
        $main = Tenant::where('slug', $mainSlug)->first();
        $dup = Tenant::where('slug', $dupSlug)->first();

        if ($main && $dup && $main->id !== $dup->id) {
            // Move Customers
            Customer::withoutGlobalScopes()->where('tenant_id', $dup->id)
                ->update(['tenant_id' => $main->id]);
            
            // Move Devices
            Device::where('tenant_id', $dup->id)
                ->update(['tenant_id' => $main->id]);

            // Move PointMovements
            PointMovement::withoutGlobalScopes()->where('tenant_id', $dup->id)
                ->update(['tenant_id' => $main->id]);

            // Move Visits
            if (Schema::hasTable('visits') && Schema::hasColumn('visits', 'tenant_id')) {
                Visit::withoutGlobalScopes()->where('tenant_id', $dup->id)
                    ->update(['tenant_id' => $main->id]);
            }

            // Sync Users
            User::where('tenant_id', $dup->id)->update(['tenant_id' => $main->id]);
            
            $dup->delete();
        }
    }

    private function restoreSlug($targetSlug, $finalSlug)
    {
        $tenant = Tenant::where('slug', $targetSlug)->first();
        if ($tenant) {
            // Check if finalSlug is already taken by someone else
            $exists = Tenant::where('slug', $finalSlug)->where('id', '!=', $tenant->id)->exists();
            if (!$exists) {
                $tenant->slug = $finalSlug;
                $tenant->save();
            }
        }
    }

    public function down(): void {}
};
