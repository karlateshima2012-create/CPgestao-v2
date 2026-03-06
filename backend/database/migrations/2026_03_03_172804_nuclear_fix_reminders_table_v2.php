<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (config('database.default') !== 'sqlite') {
            DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        }
        Schema::dropIfExists('customer_reminders');
        
        // Criar usando string simples (VARCHAR 255) para evitar QUALQUER problema de truncamento no MySQL
        Schema::create('customer_reminders', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('tenant_id', 100);
            $table->string('customer_id', 100);
            $table->date('reminder_date');
            $table->time('reminder_time');
            $table->string('reminder_text', 255);
            $table->string('status', 20)->default('pending');
            $table->timestamps();
            
            // Índices para performance mas sem travas de tipo estrito demais no início
            $table->index('tenant_id');
            $table->index('customer_id');
        });
        if (config('database.default') !== 'sqlite') {
            DB::statement('SET FOREIGN_KEY_CHECKS=1;');
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
