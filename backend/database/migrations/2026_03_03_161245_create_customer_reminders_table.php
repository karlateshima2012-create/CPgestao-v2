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
        if (!Schema::hasTable('customer_reminders')) {
            Schema::create('customer_reminders', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
                $table->foreignUuid('customer_id')->constrained()->onDelete('cascade');
                $table->date('reminder_date');
                $table->time('reminder_time');
                $table->string('reminder_text');
                $table->enum('status', ['pending', 'sent', 'cancelled'])->default('pending');
                $table->timestamps();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('customer_reminders');
    }
};
