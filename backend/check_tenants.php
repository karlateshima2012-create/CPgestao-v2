<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Tenant;
use App\Models\Customer;

$tenants = Tenant::all(['id', 'name', 'slug']);
foreach ($tenants as $t) {
    $t->customers_count = Customer::where('tenant_id', $t->id)->count();
}

echo json_encode($tenants, JSON_PRETTY_PRINT);
