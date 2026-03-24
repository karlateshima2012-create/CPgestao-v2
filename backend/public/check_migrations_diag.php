<?php
require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

echo "MIGRATIONS DONE:\n";
print_r(DB::table('migrations')->orderBy('id', 'desc')->limit(10)->pluck('migration'));
