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
        Schema::create('tenants', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('email');
            $table->string('slug')->unique();
            $table->string('plan');
            $table->string('status')->default('active'); // active, warning, expired
            $table->string('renewal_date')->nullable();
            $table->boolean('loyalty_active')->default(true);
            $table->integer('points_goal')->default(10);
            $table->string('reward_text')->default('Prêmio');
            $table->string('logo_url')->nullable();
            $table->text('description')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tenants');
    }
};
