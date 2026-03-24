<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\User;

$users = User::all(['id', 'email', 'role', 'tenant_id']);
echo json_encode($users, JSON_PRETTY_PRINT);
