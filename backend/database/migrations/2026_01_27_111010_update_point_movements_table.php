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
        Schema::table('point_movements', function (Blueprint $table) {
            $table->string('origin')->change();
            $table->string('description')->nullable()->after('origin');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('point_movements', function (Blueprint $table) {
            $table->dropColumn('description');
        });
    }
};
