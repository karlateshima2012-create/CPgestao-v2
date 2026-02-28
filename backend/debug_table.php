<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\Schema;

$table = 'customers';
$columns = Schema::getColumnListing($table);
foreach ($columns as $column) {
    $type = Schema::getColumnType($table, $column);
    echo "$column | $type\n";
}
