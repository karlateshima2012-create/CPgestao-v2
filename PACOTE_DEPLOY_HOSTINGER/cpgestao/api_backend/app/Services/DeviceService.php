<?php

namespace App\Services;

use App\Models\Device;
use App\Models\DeviceBatch;
use App\Utils\Luhn;
use Illuminate\Support\Facades\DB;
use Exception;

class DeviceService
{
    /**
     * Create a batch of premium devices with unique Luhn UIDs.
     */
    public function createPremiumBatch(string $tenantId, int $quantity, ?string $label = null): DeviceBatch
    {
        return DB::transaction(function () use ($tenantId, $quantity, $label) {
            $lastBatch = DeviceBatch::where('tenant_id', $tenantId)
                ->orderBy('batch_number', 'desc')
                ->first();
            
            $nextBatchNumber = $lastBatch ? $lastBatch->batch_number + 1 : 1;

            $batch = DeviceBatch::create([
                'tenant_id' => $tenantId,
                'quantity' => $quantity,
                'label' => $label,
                'type' => 'premium',
                'batch_number' => $nextBatchNumber,
            ]);

            for ($i = 0; $i < $quantity; $i++) {
                $this->generateDevice($batch);
            }

            return $batch;
        });
    }

    /**
     * Generate a single device for a batch, handling collisions.
     */
    private function generateDevice(DeviceBatch $batch): Device
    {
        $maxRetries = 10;
        $retries = 0;

        while ($retries < $maxRetries) {
            try {
                $uid = Luhn::generate(12);
                
                return Device::create([
                    'tenant_id' => $batch->tenant_id,
                    'batch_id' => $batch->id,
                    'type' => 'premium',
                    'uid' => $uid,
                    'status' => 'assigned',
                    'active' => true,
                ]);
            } catch (Exception $e) {
                // Likely a unique constraint violation on UID
                $retries++;
                if ($retries === $maxRetries) {
                    throw new Exception("Failed to generate a unique UID after {$maxRetries} attempts.");
                }
            }
        }

        throw new Exception("Unexpected error in device generation.");
    }

    /**
     * Link a premium device to a customer.
     */
    public function linkDeviceToCustomer(string $uid, string $customerId, string $tenantId): Device
    {
        $device = Device::where('uid', $uid)
            ->where('tenant_id', $tenantId)
            ->where('type', 'premium')
            ->firstOrFail();

        if (!$device->active || $device->status === 'disabled') {
            throw new Exception("This device is not active.");
        }

        $device->update([
            'linked_customer_id' => $customerId,
            'status' => 'linked',
        ]);

        return $device;
    }
}
