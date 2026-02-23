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
        Schema::table('tenant_settings', function (Blueprint $table) {
            $table->string('pin', 4)->nullable()->after('pin_hash');
        });
        
        // Populate existing pins if any (optional, but good for consistency)
        // Since we can't recover hashes, we'll leave as null or default '1234'
        DB::table('tenant_settings')->update(['pin' => '1234']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tenant_settings', function (Blueprint $table) {
            $table->dropColumn('pin');
        });
    }
};
