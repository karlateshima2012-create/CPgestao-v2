<?php
require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;

echo "<pre>";
echo "FORCING DATABASE SYNC...\n";

try {
    // 1. Force Visits table schema
    echo "Updating 'visits' table...\n";
    if (!Schema::hasColumn('visits', 'tenant_id')) {
         Schema::table('visits', function (Blueprint $table) {
             $table->uuid('tenant_id')->after('id')->nullable()->index();
         });
         echo " - Added tenant_id\n";
    }
    
    if (!Schema::hasColumn('visits', 'visit_at')) {
         Schema::table('visits', function (Blueprint $table) {
             $table->dateTime('visit_at')->after('customer_id')->nullable()->index();
         });
         echo " - Added visit_at\n";
    }

    if (!Schema::hasColumn('visits', 'points_granted')) {
         Schema::table('visits', function (Blueprint $table) {
             $table->integer('points_granted')->default(0);
         });
         echo " - Added points_granted\n";
    }

    if (!Schema::hasColumn('visits', 'origin')) {
         Schema::table('visits', function (Blueprint $table) {
             $table->string('origin')->default('manual');
         });
         echo " - Added origin\n";
    }

    // 2. Force Customers table schema
    echo "Updating 'customers' table...\n";
    if (Schema::hasColumn('customers', 'photo_url') && !Schema::hasColumn('customers', 'foto_perfil_url')) {
        Schema::table('customers', function (Blueprint $table) {
            $table->renameColumn('photo_url', 'foto_perfil_url');
        });
        echo " - Renamed photo_url to foto_perfil_url\n";
    }

    echo "SYNC COMPLETED SUCCESSFULLY.\n";

} catch (\Exception $e) {
    echo "ERROR DURING SYNC: " . $e->getMessage() . "\n";
}

echo "</pre>";
