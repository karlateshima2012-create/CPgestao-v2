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
        Schema::create('point_requests', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('store_id');
            $table->foreign('store_id')->references('id')->on('tenants')->onDelete('cascade');
            $table->uuid('client_id')->nullable();
            $table->foreign('client_id')->references('id')->on('customers')->onDelete('cascade');
            $table->string('phone');
            $table->uuid('device_id')->nullable();
            $table->foreign('device_id')->references('id')->on('devices')->onDelete('set null');
            $table->enum('source', ['approval', 'manual_card', 'online_qr', 'auto_checkin']);
            $table->enum('status', ['pending', 'approved', 'denied', 'auto_approved'])->default('pending');
            $table->integer('requested_points')->default(1);
            $table->uuid('approved_by')->nullable();
            $table->foreign('approved_by')->references('id')->on('users')->onDelete('set null');
            $table->timestamps();
            $table->timestamp('approved_at')->nullable();

            $table->index(['store_id', 'status']);
            $table->index('phone');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('point_requests');
    }
};
