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
        // Force check and add missing columns to customers table
        Schema::table('customers', function (Blueprint $table) {
            if (!Schema::hasColumn('customers', 'company_name')) {
                $table->string('company_name', 100)->nullable()->after('phone');
            }
            
            if (!Schema::hasColumn('customers', 'foto_perfil_url')) {
                // Check if old name exists to rename, otherwise create
                if (Schema::hasColumn('customers', 'photo_url')) {
                    $table->renameColumn('photo_url', 'foto_perfil_url');
                } else {
                    $table->string('foto_perfil_url', 255)->nullable()->after('name');
                }
            }

            if (!Schema::hasColumn('customers', 'postal_code')) {
                $table->string('postal_code', 20)->nullable()->after('city');
            }

            if (!Schema::hasColumn('customers', 'address')) {
                $table->string('address', 255)->nullable()->after('postal_code');
            }

            if (!Schema::hasColumn('customers', 'reminder_time')) {
                $table->time('reminder_time')->nullable()->after('reminder_date');
            }
        });

        // Force check and add missing columns to visits table
        Schema::table('visits', function (Blueprint $table) {
            if (!Schema::hasColumn('visits', 'foto_perfil_url')) {
                if (Schema::hasColumn('visits', 'customer_photo_url')) {
                    $table->renameColumn('customer_photo_url', 'foto_perfil_url');
                } else {
                    $table->string('foto_perfil_url', 255)->nullable()->after('customer_company');
                }
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No specific rollback for a structural fix migration
    }
};
