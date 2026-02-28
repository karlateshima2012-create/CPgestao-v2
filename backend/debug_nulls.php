<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$columns = DB::select("PRAGMA table_info(customers)");
foreach ($columns as $column) {
    echo $column->name . " | " . ($column->notnull ? "NOT NULL" : "NULL") . "\n";
}
