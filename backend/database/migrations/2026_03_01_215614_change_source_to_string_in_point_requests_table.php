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
        Schema::table('point_requests', function (Blueprint $table) {
            $table->string('source')->nullable()->default('approval')->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('point_requests', function (Blueprint $table) {
            $table->enum('source', ['approval', 'manual_card', 'online_qr', 'auto_checkin'])->default('approval')->change();
        });
    }
};
