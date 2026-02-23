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
        // Add loyalty_level to customers
        Schema::table('customers', function (Blueprint $table) {
            $table->integer('loyalty_level')->default(1)->after('points_balance');
        });

        // Add goal_points and redeem_bonus_points to loyalty_settings
        Schema::table('loyalty_settings', function (Blueprint $table) {
            $table->integer('points_goal')->default(10)->after('tenant_id');
            $table->integer('redeem_bonus_points')->default(1)->after('points_goal');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn('loyalty_level');
        });

        Schema::table('loyalty_settings', function (Blueprint $table) {
            $table->dropColumn(['points_goal', 'redeem_bonus_points']);
        });
    }
};
