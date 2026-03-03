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
        // Nuclear fix: Use a completely new table name to avoid any schema/cache issues with the old one
        try {
            DB::statement('SET FOREIGN_KEY_CHECKS=0;');
            DB::statement('DROP TABLE IF EXISTS customer_reminders;');
            DB::statement('DROP TABLE IF EXISTS crm_reminders;');
            
            // Use VARCHAR(255) for all UUID fields to be 100% safe
            DB::statement("
                CREATE TABLE crm_reminders (
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
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Migration Error (CRM Reminders): ' . $e->getMessage());
            
            // Fallback for SQLite/Local
            Schema::dropIfExists('crm_reminders');
            Schema::create('crm_reminders', function (Blueprint $table) {
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
        Schema::dropIfExists('crm_reminders');
    }
};
