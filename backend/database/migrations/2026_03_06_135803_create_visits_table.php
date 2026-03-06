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
        Schema::create('visits', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->index();
            $table->uuid('customer_id')->index();
            
            // Redundant for performance/logging as requested
            $table->string('customer_name');
            $table->string('customer_phone');
            $table->string('customer_company')->nullable();
            $table->string('customer_photo_url')->nullable();
            
            $table->dateTime('visit_at')->index();
            $table->string('origin'); // nfc | qr | manual | sistema
            $table->string('plan_type'); // pro | elite
            $table->string('status')->index(); // pendente | aprovado | negado
            $table->integer('points_granted')->default(0);
            
            $table->uuid('approved_by')->nullable();
            $table->dateTime('approved_at')->nullable();
            
            $table->json('meta')->nullable();
            $table->timestamps();
            
            // Indexes for performance
            $table->index(['tenant_id', 'visit_at']);
            $table->index(['tenant_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('visits');
    }
};
