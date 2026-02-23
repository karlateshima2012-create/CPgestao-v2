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
        Schema::create('devices', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            $table->uuid('batch_id')->nullable();
            $table->foreign('batch_id')->references('id')->on('device_batches')->onDelete('set null');
            $table->enum('type', ['totem', 'premium'])->default('totem');
            $table->string('uid')->unique();
            $table->boolean('active')->default(true);
            $table->enum('status', ['assigned', 'linked', 'disabled'])->default('assigned');
            $table->uuid('linked_customer_id')->nullable();
            $table->foreign('linked_customer_id')->references('id')->on('customers')->onDelete('set null');
            $table->timestamps();

            $table->index(['tenant_id', 'type', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('devices');
    }
};
