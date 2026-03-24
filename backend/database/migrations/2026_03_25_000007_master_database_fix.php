<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Fix CUSTOMERS table
        if (Schema::hasTable('customers')) {
            Schema::table('customers', function (Blueprint $table) {
                if (!Schema::hasColumn('customers', 'foto_perfil_url')) {
                    if (Schema::hasColumn('customers', 'photo_url')) {
                        $table->renameColumn('photo_url', 'foto_perfil_url');
                    } else {
                        $table->string('foto_perfil_url')->nullable();
                    }
                }
                
                if (!Schema::hasColumn('customers', 'company_name')) {
                    if (Schema::hasColumn('customers', 'company')) {
                        $table->renameColumn('company', 'company_name');
                    } else {
                        $table->string('company_name')->nullable();
                    }
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
        }

        // 2. Fix VISITS table (Recreate to be sure)
        Schema::dropIfExists('visits');
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
            $table->string('origin'); // nfc | qr | manual | sistema
            $table->string('plan_type')->nullable(); // pro | elite
            $table->string('status')->index(); // pendente | aprovado | negado
            $table->integer('points_granted')->default(0);
            
            $table->uuid('approved_by')->nullable();
            $table->dateTime('approved_at')->nullable();
            
            $table->json('meta')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
