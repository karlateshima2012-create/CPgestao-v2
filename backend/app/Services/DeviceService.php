<?php

namespace App\Services;

use App\Models\Device;
use Illuminate\Support\Facades\DB;
use Exception;

class DeviceService
{
    /**
     * Create/Retrieve a virtual online QR device for a tenant.
     */
    public function getOrCreateOnlineQrDevice(string $tenantId): Device
    {
        return Device::firstOrCreate([
            'tenant_id' => $tenantId,
            'mode' => 'online_qr',
        ], [
            'name' => 'Online Store (QR)',
            'nfc_uid' => 'online_' . substr($tenantId, 0, 8),
            'auto_approve' => true, // Online sales are usually auto-approved
            'active' => true,
        ]);
    }
}
