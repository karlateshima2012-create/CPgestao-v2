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
        // Limpeza absoluta das tentativas anteriores
        Schema::disableForeignKeyConstraints();
        Schema::dropIfExists('customer_reminders');
        Schema::dropIfExists('crm_reminders');
        Schema::enableForeignKeyConstraints();

        // Criação usando APENAS o Schema Builder (mais compatível com Hostinger/MariaDB)
        Schema::create('crm_reminders', function (Blueprint $table) {
            $table->uuid('id')->primary();
            // Usando VARCHAR(191) que é o padrão de segurança do Laravel para índices
            $table->string('tenant_id', 100);
            $table->string('customer_id', 100);
            $table->date('reminder_date');
            $table->time('reminder_time');
            $table->text('reminder_text');
            $table->string('status', 50)->default('pending');
            $table->timestamps();
            
            // Adicionando índices sem FKs estritas inicialmente para garantir a criação
            $table->index('tenant_id');
            $table->index('customer_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('crm_reminders');
    }
};
