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
        // For SQLite, we might need a different approach, but Laravel handles many cases.
        // Let's try to drop the ghost foreign key and add the correct one.
        Schema::table('point_requests', function (Blueprint $table) {
            // SQLite might error on dropForeign if the table it points to doesn't exist.
            // But we already dropped loyalty_cards.
            try {
                if (config('database.default') !== 'sqlite') {
                    $table->dropForeign(['device_id']);
                }
            } catch (\Exception $e) {
               // Silently ignore if already gone
            }
        });

        Schema::table('point_requests', function (Blueprint $table) {
            $table->foreign('device_id')->references('id')->on('devices')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('point_requests', function (Blueprint $table) {
            // $table->dropForeign(['device_id']);
        });
    }
};
