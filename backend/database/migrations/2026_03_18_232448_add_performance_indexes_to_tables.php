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
        Schema::table('customers', function (Blueprint $table) {
            $table->index(['tenant_id', 'created_at']);
            $table->index(['tenant_id', 'last_activity_at']);
        });

        Schema::table('point_movements', function (Blueprint $table) {
            $table->index(['tenant_id', 'customer_id'], 'pm_tenant_customer_idx');
            $table->index(['tenant_id', 'created_at']);
        });

        Schema::table('point_requests', function (Blueprint $table) {
            $table->index(['tenant_id', 'created_at']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->index(['tenant_id', 'role']);
        });

        Schema::table('devices', function (Blueprint $table) {
            $table->index(['tenant_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropIndex(['tenant_id', 'created_at']);
            $table->dropIndex(['tenant_id', 'last_activity_at']);
        });

        Schema::table('point_movements', function (Blueprint $table) {
            $table->dropIndex('pm_tenant_customer_idx');
            $table->dropIndex(['tenant_id', 'created_at']);
        });

        Schema::table('point_requests', function (Blueprint $table) {
            $table->dropIndex(['tenant_id', 'created_at']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['tenant_id', 'role']);
        });

        Schema::table('devices', function (Blueprint $table) {
            $table->dropIndex(['tenant_id', 'status']);
        });
    }
};
