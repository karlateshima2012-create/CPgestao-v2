<?php
require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\Artisan;

echo "<pre>";
echo "Running migrations...\n";
try {
    $exitCode = Artisan::call('migrate', ['--force' => true]);
    echo "Exit Code: " . $exitCode . "\n";
    echo "Output:\n" . Artisan::output();
} catch (\Exception $e) {
    echo "ERROR:\n" . $e->getMessage();
}
echo "</pre>";
