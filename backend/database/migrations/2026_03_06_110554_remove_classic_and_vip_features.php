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
        // 1. Remove tables
        Schema::disableForeignKeyConstraints();
        Schema::dropIfExists('loyalty_cards');
        Schema::dropIfExists('device_batches');
        Schema::enableForeignKeyConstraints();

        // 2. Remove column from customers
        Schema::table('customers', function (Blueprint $table) {
            if (Schema::hasColumn('customers', 'is_premium')) {
                $table->dropColumn('is_premium');
            }
        });

        // 3. Remove Classic Plan from plans table (data cleanup)
        \Illuminate\Support\Facades\DB::table('plans')->where('slug', 'classic')->delete();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Not easily reversible without data loss
        Schema::table('customers', function (Blueprint $table) {
            $table->boolean('is_premium')->default(false)->after('address');
        });
    }
};
