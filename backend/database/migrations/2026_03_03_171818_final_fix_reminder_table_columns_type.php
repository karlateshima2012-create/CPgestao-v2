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
        // Forçar a exclusão e recriação da tabela para garantir que o tipo de dado seja UUID (char 36) no MySQL
        Schema::disableForeignKeyConstraints();
        Schema::dropIfExists('customer_reminders');
        
        Schema::create('customer_reminders', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('tenant_id', 36);
            $table->char('customer_id', 36);
            $table->date('reminder_date');
            $table->time('reminder_time');
            $table->string('reminder_text');
            $table->string('status')->default('pending'); // Usando string em vez de enum para maior flexibilidade no SQLite/MySQL
            $table->timestamps();
            
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            $table->foreign('customer_id')->references('id')->on('customers')->onDelete('cascade');
        });
        Schema::enableForeignKeyConstraints();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('customer_reminders');
    }
};
