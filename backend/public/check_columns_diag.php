<?php
require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\Schema;

echo "Columns in visits table:\n";
print_r(Schema::getColumnListing('visits'));
echo "\nColumns in customers table:\n";
print_r(Schema::getColumnListing('customers'));
