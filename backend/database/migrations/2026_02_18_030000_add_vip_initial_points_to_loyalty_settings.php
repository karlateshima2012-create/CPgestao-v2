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
        Schema::table('loyalty_settings', function (Blueprint $table) {
            $table->integer('vip_initial_points')->default(0)->after('redeem_bonus_points');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('loyalty_settings', function (Blueprint $table) {
            $table->dropColumn('vip_initial_points');
        });
    }
};
