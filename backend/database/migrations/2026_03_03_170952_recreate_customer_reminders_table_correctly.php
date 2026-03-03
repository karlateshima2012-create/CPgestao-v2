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
        Schema::dropIfExists('customer_reminders');
        
        Schema::create('customer_reminders', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('customer_id');
            $table->date('reminder_date');
            $table->time('reminder_time');
            $table->string('reminder_text');
            $table->enum('status', ['pending', 'sent', 'cancelled'])->default('pending');
            $table->timestamps();
            
            // Re-add constraints if needed, but uuid to uuid just works
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            $table->foreign('customer_id')->references('id')->on('customers')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('customer_reminders');
    }
};
