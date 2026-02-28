<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\LoyaltyCard;

$cards = LoyaltyCard::withoutGlobalScopes()->get();
echo "Total cards in DB: " . $cards->count() . "\n";
foreach($cards as $c) {
    if (str_contains($c->uid, '5296')) {
        echo "- UID: " . $c->uid . ", Tenant: " . $c->tenant_id . ", Status: " . $c->status . "\n";
    }
}
