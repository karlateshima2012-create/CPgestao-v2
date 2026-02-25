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
        Schema::table('point_requests', function (Blueprint $table) {
            $table->renameColumn('store_id', 'tenant_id');
            $table->renameColumn('client_id', 'customer_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('point_requests', function (Blueprint $table) {
            $table->renameColumn('tenant_id', 'store_id');
            $table->renameColumn('customer_id', 'client_id');
        });
    }
};
