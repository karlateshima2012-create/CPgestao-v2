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
        $botToken = env('TELEGRAM_BOT_TOKEN');

        if (!$settings || !$botToken || !$settings->telegram_chat_id) {
            return;
        }

        try {
            $url = "https://api.telegram.org/bot{$botToken}/sendMessage";
            
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
                'parse_mode' => 'MarkdownV2',
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
    public function sendDirectMessage(string $chatId, string $message, bool $disableNotification = false, $replyMarkup = null): void
    {
        $botToken = env('TELEGRAM_BOT_TOKEN');

        if (!$botToken || !$chatId) {
            Log::warning('TelegramService (Direct): Missing bot token or chat ID.', ['chat_id' => $chatId]);
            return;
        }

        try {
            $url = "https://api.telegram.org/bot{$botToken}/sendMessage";
            
            $payload = [
                'chat_id' => $chatId,
                'text' => $message,
                'parse_mode' => 'MarkdownV2',
                'disable_notification' => $disableNotification,
            ];

            if ($replyMarkup) {
                $payload['reply_markup'] = json_encode($replyMarkup);
            }

            $response = Http::post($url, $payload);

            if ($response->failed()) {
                Log::error("Telegram direct notification failed for chat {$chatId}: " . $response->body());
            }
        } catch (\Exception $e) {
            Log::error("Telegram direct notification exception for chat {$chatId}: " . $e->getMessage());
        }
    }

    /**
     * Update an existing Telegram message (e.g., after a button click).
     */
    public function editMessage(string $chatId, int $messageId, string $text, $replyMarkup = null): void
    {
        $botToken = env('TELEGRAM_BOT_TOKEN');

        if (!$botToken) return;

        try {
            $url = "https://api.telegram.org/bot{$botToken}/editMessageText";
            
            $payload = [
                'chat_id' => $chatId,
                'message_id' => $messageId,
                'text' => $text,
                'send_sound' => false,
                'parse_mode' => 'MarkdownV2',
            ];

            if ($replyMarkup) {
                $payload['reply_markup'] = json_encode($replyMarkup);
            }

            Http::post($url, $payload);
        } catch (\Exception $e) {
            Log::error("Telegram editMessage exception: " . $e->getMessage());
        }
    }

    /**
     * Answer a callback query to stop the loading spinner on the button.
     */
    public function answerCallbackQuery(string $callbackQueryId, string $text = '', bool $showAlert = false): void
    {
        $botToken = env('TELEGRAM_BOT_TOKEN');

        if (!$botToken) return;

        try {
            $url = "https://api.telegram.org/bot{$botToken}/answerCallbackQuery";
            
            $payload = [
                'callback_query_id' => $callbackQueryId,
                'text' => $text,
                'show_alert' => $showAlert,
            ];

            Http::post($url, $payload);
        } catch (\Exception $e) {
            Log::error("Telegram answerCallbackQuery exception: " . $e->getMessage());
        }
    }

    public static function escapeMarkdownV2(string $text): string
    {
        $specialChars = ['\\', '_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];
        $escapedChars = [];
        foreach ($specialChars as $char) {
            $escapedChars[] = '\\' . $char;
        }
        return str_replace($specialChars, $escapedChars, $text);
    }
}
