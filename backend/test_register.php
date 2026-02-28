<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Tenant;
use App\Models\Customer;
use App\Models\LoyaltySetting;
use App\Utils\PhoneHelper;
use Illuminate\Support\Facades\DB;

$slug = 'deivid-3d-classico';
$tenant = Tenant::where('slug', $slug)->first();
echo "Tenant: " . ($tenant ? $tenant->name : "Not Found") . "\n";

$phone = '09012345678';
$normalized = PhoneHelper::normalize($phone);
echo "Normalized Phone: $normalized\n";

try {
    DB::transaction(function() use ($tenant, $normalized) {
        echo "Inside Transaction\n";
        
        $customer = Customer::create([
            'tenant_id' => $tenant->id,
            'name' => 'Test User',
            'phone' => $normalized,
            'source' => 'terminal',
            'last_activity_at' => now()
        ]);
        echo "Customer Created: " . $customer->id . "\n";
        
        $loyalty = LoyaltySetting::withoutGlobalScopes()->where('tenant_id', $tenant->id)->first();
        if (!$loyalty) {
            echo "Creating Loyalty Settings\n";
            $loyalty = LoyaltySetting::withoutGlobalScopes()->create(['tenant_id' => $tenant->id]);
        }
        echo "Loyalty Settings ID: " . ($loyalty ? $loyalty->tenant_id : "Null") . "\n";
        
        echo "Done\n";
    });
} catch (\Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
}
