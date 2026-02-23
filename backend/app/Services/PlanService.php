<?php

namespace App\Services;

use App\Models\Tenant;
use App\Models\Device;
use Exception;

class PlanService
{
    /**
     * Check if a tenant can add a new terminal device.
     */
    public function canAddDevice(Tenant $tenant): bool
    {
        $limit = (int)$tenant->getPlanFeature('device_limit', 0);
        $currentCount = Device::where('tenant_id', $tenant->id)->count();

        return $currentCount < $limit;
    }

    /**
     * Check if a tenant can use auto-approval for point requests.
     */
    public function canAutoApprove(Tenant $tenant): bool
    {
        return (bool)$tenant->getPlanFeature('allow_auto_approve', 0);
    }

    /**
     * Check if a tenant can use online QR mode.
     */
    public function canUseOnlineQr(Tenant $tenant): bool
    {
        return (bool)$tenant->getPlanFeature('allow_online_qr', 0);
    }

    /**
     * Get the minimum interval in minutes for check-ins.
     */
    public function getMinCheckinInterval(Tenant $tenant): int
    {
        return (int)$tenant->getPlanFeature('min_interval_minutes', 0);
    }

    /**
     * Enforce device limit.
     */
    public function validateDeviceLimit(Tenant $tenant)
    {
        if (!$this->canAddDevice($tenant)) {
            throw new Exception("Seu plano atingiu o limite de dispositivos conectados.");
        }
    }
}
