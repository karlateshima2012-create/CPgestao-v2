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
    public function sendMessage(string $tenantId, string $message, string $type = 'registration'): void
    {
        $settings = TenantSetting::where('tenant_id', $tenantId)->first();

        if (!$settings || !$settings->telegram_bot_token || !$settings->telegram_chat_id) {
            return;
        }

        try {
            $url = "https://api.telegram.org/bot{$settings->telegram_bot_token}/sendMessage";
            
            $disableNotification = false;
            if ($type === 'registration') {
                $disableNotification = !$settings->telegram_sound_registration;
            } elseif ($type === 'points') {
                $disableNotification = !$settings->telegram_sound_points;
            } elseif ($type === 'reminder') {
                $disableNotification = !$settings->telegram_sound_reminders;
            }

            $response = Http::post($url, [
                'chat_id' => $settings->telegram_chat_id,
                'text' => $message,
                'parse_mode' => 'HTML',
                'disable_notification' => $disableNotification,
            ]);

            if ($response->failed()) {
                Log::error("Telegram notification failed for tenant {$tenantId}: " . $response->body());
            }
        } catch (\Exception $e) {
            Log::error("Telegram notification exception for tenant {$tenantId}: " . $e->getMessage());
        }
    }

    /**
     * Send a notification to a specific Chat ID using the central app bot.
     */
    public function sendDirectMessage(string $chatId, string $message, bool $disableNotification = false): void
    {
        $botToken = env('TELEGRAM_BOT_TOKEN');

        if (!$botToken || !$chatId) {
            Log::warning('TelegramService (Direct): Missing bot token or chat ID.', ['chat_id' => $chatId]);
            return;
        }

        try {
            $url = "https://api.telegram.org/bot{$botToken}/sendMessage";
            
            $response = Http::post($url, [
                'chat_id' => $chatId,
                'text' => $message,
                'parse_mode' => 'HTML',
                'disable_notification' => $disableNotification,
            ]);

            if ($response->failed()) {
                Log::error("Telegram direct notification failed for chat {$chatId}: " . $response->body());
            }
        } catch (\Exception $e) {
            Log::error("Telegram direct notification exception for chat {$chatId}: " . $e->getMessage());
        }
    }
}
