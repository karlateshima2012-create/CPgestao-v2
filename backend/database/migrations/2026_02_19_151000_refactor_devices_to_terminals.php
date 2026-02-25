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
        // 1. Rename existing devices to loyalty_cards 
        // No MariaDB, o nome da constraint de chave estrangeira NÃO muda automaticamente.
        // Precisamos derrubar a constraint antes de renomear para evitar conflito com a nova tabela 'devices'.
        if (Schema::hasTable('devices')) {
            Schema::table('devices', function (Blueprint $table) {
                // Tentar derrubar a chave estrangeira pelo nome padrão do Laravel
                $table->dropForeign(['tenant_id']);
            });
            
            Schema::rename('devices', 'loyalty_cards');

            // Recriar a chave estrangeira na loyalty_cards com o nome correto
            Schema::table('loyalty_cards', function (Blueprint $table) {
                $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            });
        }

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
