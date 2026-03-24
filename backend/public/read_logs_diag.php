<?php
require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$log = storage_path('logs/laravel.log');
if (file_exists($log)) {
    // Read the last 200 lines
    $lines = file($log);
    $lastLines = array_slice($lines, -200);
    echo implode("", $lastLines);
} else {
    echo "Log file not found.";
}
