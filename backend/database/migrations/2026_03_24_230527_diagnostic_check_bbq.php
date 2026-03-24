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
        $tenant = Tenant::where('slug', 'bbq-in-japan')->first();
        $diag = [
            'timestamp' => now()->toDateTimeString(),
            'tenant' => $tenant ? [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'slug' => $tenant->slug,
            ] : 'NOT FOUND',
            'devices' => $tenant ? Device::where('tenant_id', $tenant->id)->get()->map(fn($d) => [
                'id' => $d->id,
                'name' => $d->name,
                'nfc_uid' => $d->nfc_uid,
                'active' => $d->active,
            ]) : [],
            'all_devices_count' => Device::count(),
            'db_connection' => config('database.default'),
        ];

        try {
           file_put_contents(public_path('diag.txt'), json_encode($diag, JSON_PRETTY_PRINT));
        } catch (\Exception $e) {
           // ignore
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        //
    }
};
