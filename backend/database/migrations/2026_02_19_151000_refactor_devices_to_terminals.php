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
        // 1. Rename existing devices to loyalty_cards (they are mostly customer tags)
        Schema::rename('devices', 'loyalty_cards');

        // 2. Create new devices table (Terminals/Totems)
        Schema::create('devices', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            $table->string('name');
            $table->string('nfc_uid')->unique(); // Unique identifier for the terminal itself
            $table->enum('mode', ['approval', 'auto_checkin', 'online_qr'])->default('approval');
            $table->boolean('auto_approve')->default(false);
            $table->boolean('active')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('devices');
        Schema::rename('loyalty_cards', 'devices');
    }
};
