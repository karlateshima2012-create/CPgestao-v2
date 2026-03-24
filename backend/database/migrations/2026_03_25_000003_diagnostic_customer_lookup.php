<?php

use Illuminate\Database\Migrations\Migration;
use App\Models\Tenant;
use App\Models\Customer;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $tenantId = '9eab65a3-718e-4a7b-a01b-96865610816a'; // Placeholder, replace if known or use slug
        $tenant = Tenant::where('slug', 'garagem-lata-velha-1')->first();
        if (!$tenant) {
            \Illuminate\Support\Facades\Log::error("DIAGNOSTIC: Tenant garagem-lata-velha-1 NOT FOUND");
            return;
        }

        $count = Customer::where('tenant_id', $tenant->id)->count();
        \Illuminate\Support\Facades\Log::info("DIAGNOSTIC: Tenant found: {$tenant->name} (slug: {$tenant->slug}) ID: {$tenant->id}. Customers count: {$count}");

        $customers = Customer::where('tenant_id', $tenant->id)->limit(10)->get(['name', 'phone']);
        foreach ($customers as $c) {
            \Illuminate\Support\Facades\Log::info("DIAGNOSTIC: Customer: {$c->name} | Phone: {$c->phone}");
        }

        // Check if there's a duplicate tenant with a different slug
        $duplicates = Tenant::where('name', 'like', '%Garagem%')->get();
        foreach ($duplicates as $d) {
             \Illuminate\Support\Facades\Log::info("DIAGNOSTIC: Potential duplicate: {$d->name} (slug: {$d->slug}) ID: {$d->id}");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
