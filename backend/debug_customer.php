<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\LoyaltyCard;
use App\Models\Customer;

$uid = '529652803907';
$phone = '09011886491';

$card = LoyaltyCard::withoutGlobalScopes()->where('uid', $uid)->first();
echo "Card: " . ($card ? "Found in tenant " . $card->tenant_id : "Not Found") . "\n";
if ($card) {
    echo "Card Status: " . $card->status . "\n";
    echo "Linked Customer ID: " . $card->linked_customer_id . "\n";
    if ($card->linked_customer_id) {
        $customer = Customer::withoutGlobalScopes()->find($card->linked_customer_id);
        echo "Customer from Card: " . ($customer ? $customer->name . " (Phone: " . $customer->phone . ")" : "Not Found") . "\n";
    }
}

$custByPhone = Customer::withoutGlobalScopes()->where('phone', $phone)->get();
echo "Customers with phone $phone: " . $custByPhone->count() . "\n";
foreach($custByPhone as $c) {
    echo "- ID: " . $c->id . ", Name: " . $c->name . ", Tenant: " . $c->tenant_id . "\n";
}
