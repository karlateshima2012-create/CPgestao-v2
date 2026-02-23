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
            $table->timestamp('last_activity_at')->nullable()->after('points_balance');
            $table->index(['tenant_id', 'last_activity_at']);
        });

        Schema::table('tenants', function (Blueprint $table) {
            $table->integer('points_per_earn')->default(1)->after('points_goal');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn('last_activity_at');
        });

        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn('points_per_earn');
        });
    }
};
