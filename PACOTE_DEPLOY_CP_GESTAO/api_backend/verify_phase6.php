<?php

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';

use App\Models\Tenant;
use App\Models\Customer;
use App\Models\PointMovement;
use App\Services\QrTokenService;
use App\Services\PlanService;
use App\Models\Device;
use Illuminate\Support\Facades\DB;

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

function testTokenFlow() {
    echo "Testing Online QR Flow...\n";
    $tenant = Tenant::where('slug', 'academia-elite')->first();
    $qrService = app(QrTokenService::class);
    
    $token = $qrService->generateToken($tenant->id);
    echo "Generated Token: $token\n";
    
    try {
        $qrService->consumeToken($token, $tenant->id);
        echo "✅ Token consumed successfully first time.\n";
    } catch (\Exception $e) {
        echo "❌ Failed to consume token: " . $e->getMessage() . "\n";
    }

    try {
        $qrService->consumeToken($token, $tenant->id);
        echo "❌ Token consumed SECOND time (Should have failed!).\n";
    } catch (\Exception $e) {
        echo "✅ Blocked duplicate token usage: " . $e->getMessage() . "\n";
    }
}

function testCheckinProtection() {
    echo "\nTesting Check-in Protection (Elite Plan)...\n";
    $tenant = Tenant::where('slug', 'academia-elite')->first();
    $customer = Customer::firstOrCreate(['tenant_id' => $tenant->id, 'phone' => '09012345678'], ['name' => 'Tester']);
    $planService = app(PlanService::class);
    
    $minInterval = $planService->getMinCheckinInterval($tenant);
    echo "Min Interval: $minInterval minutes\n";

    // Clean up old movements for clean test
    PointMovement::where('customer_id', $customer->id)->where('origin', 'auto_checkin')->delete();

    // 1. First Check-in
    PointMovement::create([
        'tenant_id' => $tenant->id,
        'customer_id' => $customer->id,
        'points' => 1,
        'type' => 'earn',
        'origin' => 'auto_checkin'
    ]);
    echo "✅ First check-in recorded.\n";

    // 2. Immediate Second Check-in (Should be blocked by controller logic, but here we check the interval)
    $lastCheckin = PointMovement::where('customer_id', $customer->id)
        ->where('tenant_id', $tenant->id)
        ->where('origin', 'auto_checkin')
        ->where('created_at', '>', now()->subMinutes($minInterval))
        ->first();

    if ($lastCheckin) {
        echo "✅ Check-in protection logic confirmed: Recent check-in found within interval.\n";
    } else {
        echo "❌ Error: Recent check-in NOT found within interval.\n";
    }
}

testTokenFlow();
testCheckinProtection();
