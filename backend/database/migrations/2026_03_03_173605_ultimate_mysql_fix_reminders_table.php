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
        // No MySQL do Hostinger, às vezes a mudança de tipo de coluna falha silenciosamente se houver dados ou constraints.
        // Esta migração usa SQL puro para garantir a recriação com tipos de dados flexíveis.
        
        try {
            DB::statement('SET FOREIGN_KEY_CHECKS=0;');
            DB::statement('DROP TABLE IF EXISTS customer_reminders;');
            
            // Criando com VARCHAR(255) para os IDs para garantir que QUALQUER UUID caiba sem truncamento.
            // O erro 1265 acontece quando o MySQL tenta colocar uma string num campo INT ou numa string curta demais.
            DB::statement("
                CREATE TABLE customer_reminders (
                    id CHAR(36) NOT NULL,
                    tenant_id VARCHAR(255) NOT NULL,
                    customer_id VARCHAR(255) NOT NULL,
                    reminder_date DATE NOT NULL,
                    reminder_time TIME NOT NULL,
                    reminder_text TEXT NOT NULL,
                    status VARCHAR(50) DEFAULT 'pending',
                    created_at TIMESTAMP NULL DEFAULT NULL,
                    updated_at TIMESTAMP NULL DEFAULT NULL,
                    PRIMARY KEY (id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");
            
            DB::statement('SET FOREIGN_KEY_CHECKS=1;');
        } catch (\Exception $e) {
            // Se falhar o SQL puro (ex: em SQLite local), usamos o Schema builder como fallback
            Schema::dropIfExists('customer_reminders');
            Schema::create('customer_reminders', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->string('tenant_id', 255);
                $table->string('customer_id', 255);
                $table->date('reminder_date');
                $table->time('reminder_time');
                $table->text('reminder_text');
                $table->string('status', 50)->default('pending');
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
