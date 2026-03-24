<?php
require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\Schema;

echo "COLUMNS_VISITS: ";
echo implode(',', Schema::getColumnListing('visits'));
echo "\nCOLUMNS_CUSTOMERS: ";
echo implode(',', Schema::getColumnListing('customers'));
