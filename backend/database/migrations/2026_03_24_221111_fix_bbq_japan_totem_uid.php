<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Models\Tenant;
use App\Models\Device;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // One-time fix for BBQ IN JAPAN totem UID
        $tenant = Tenant::where('slug', 'bbq-in-japan')->first();
        if ($tenant) {
            $device = Device::where('tenant_id', $tenant->id)->first();
            if ($device) {
                $device->nfc_uid = 'auBrnT2GxdjY';
                $device->save();
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No reverse action needed for a data fix
    }
};
