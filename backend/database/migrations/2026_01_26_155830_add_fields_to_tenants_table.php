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
        Schema::table('tenants', function (Blueprint $table) {
            $table->string('owner_name')->nullable()->after('name');
            $table->string('phone')->nullable()->after('owner_name');
            $table->timestamp('plan_expires_at')->nullable()->after('plan');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn(['owner_name', 'phone', 'plan_expires_at']);
        });
    }
};
