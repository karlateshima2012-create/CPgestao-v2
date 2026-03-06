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
        Schema::table('customers', function (Blueprint $table) {
            $table->renameColumn('photo_url', 'foto_perfil_url');
        });

        Schema::table('visits', function (Blueprint $table) {
            $table->renameColumn('customer_photo_url', 'foto_perfil_url');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->renameColumn('foto_perfil_url', 'photo_url');
        });

        Schema::table('visits', function (Blueprint $table) {
            $table->renameColumn('foto_perfil_url', 'customer_photo_url');
        });
    }
};
