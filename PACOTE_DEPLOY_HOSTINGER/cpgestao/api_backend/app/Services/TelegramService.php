<?php

namespace App\Services;

use App\Models\TenantSetting;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class TelegramService
{
    /**
     * Send a notification to the tenant's Telegram chat.
     */
    public function sendMessage(string $tenantId, string $message): void
    {
        $settings = TenantSetting::where('tenant_id', $tenantId)->first();

        if (!$settings || !$settings->telegram_bot_token || !$settings->telegram_chat_id) {
            return;
        }

        try {
            $url = "https://api.telegram.org/bot{$settings->telegram_bot_token}/sendMessage";
            
            $response = Http::post($url, [
                'chat_id' => $settings->telegram_chat_id,
                'text' => $message,
                'parse_mode' => 'HTML',
            ]);

            if ($response->failed()) {
                Log::error("Telegram notification failed for tenant {$tenantId}: " . $response->body());
            }
        } catch (\Exception $e) {
            Log::error("Telegram notification exception for tenant {$tenantId}: " . $e->getMessage());
        }
    }
}
