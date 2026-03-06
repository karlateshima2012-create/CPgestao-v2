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
        // Update all tenants with 'Classic' plan to 'Pro'
        DB::table('tenants')
            ->where('plan', 'Classic')
            ->orWhere('plan', 'classic')
            ->update(['plan' => 'Pro']);
            
        // Also update plan_id if possible
        $proPlan = DB::table('plans')->where('slug', 'pro')->first();
        if ($proPlan) {
            DB::table('tenants')
                ->where('plan', 'Pro')
                ->update(['plan_id' => $proPlan->id]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No reverse needed as we are removing Classic plan permanently
    }
};
