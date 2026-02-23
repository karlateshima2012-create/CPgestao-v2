<?php

namespace App\Services;

use App\Models\LoyaltyCard;
use App\Models\DeviceBatch;
use App\Models\Device;
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
            $lastBatch = DeviceBatch::orderBy('batch_number', 'desc')
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
     * Generate a single device (LoyaltyCard) for a batch, handling collisions.
     */
    private function generateDevice(DeviceBatch $batch): LoyaltyCard
    {
        $maxRetries = 10;
        $retries = 0;

        while ($retries < $maxRetries) {
            try {
                $uid = Luhn::generate(12);
                
                return LoyaltyCard::create([
                    'tenant_id' => $batch->tenant_id,
                    'batch_id' => $batch->id,
                    'type' => 'premium',
                    'uid' => $uid,
                    'status' => 'assigned',
                    'active' => true,
                ]);
            } catch (Exception $e) {
                $retries++;
                if ($retries === $maxRetries) {
                    throw new Exception("Failed to generate a unique UID after {$maxRetries} attempts.");
                }
            }
        }

        throw new Exception("Unexpected error in loyalty card generation.");
    }

    /**
     * Link a loyalty card to a customer.
     */
    public function linkDeviceToCustomer(string $uid, string $customerId, string $tenantId): LoyaltyCard
    {
        $card = LoyaltyCard::where('uid', $uid)
            ->where('tenant_id', $tenantId)
            ->where('type', 'premium')
            ->firstOrFail();

        if (!$card->active || $card->status === 'disabled') {
            throw new Exception("This card is not active.");
        }

        $card->update([
            'linked_customer_id' => $customerId,
            'status' => 'linked',
        ]);

        return $card;
    }

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
