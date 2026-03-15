<?php

namespace App\Services;

use App\Models\TenantSetting;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class TelegramService
{
    /**
     * Send a notification to the tenant's Telegram chat or a specific chat ID.
     */
    public function sendMessage(string $tenantId, string $message, string $type = 'registration', ?string $chatId = null, $replyMarkup = null): ?array
    {
        $settings = TenantSetting::withoutGlobalScopes()->where('tenant_id', $tenantId)->first();
        $botToken = config('services.telegram.bot_token');

        $targetChatId = $chatId ?: ($settings ? $settings->telegram_chat_id : null);

        if (!$botToken || !$targetChatId) {
            return null;
        }

        try {
            $url = "https://api.telegram.org/bot{$botToken}/sendMessage";
            
            $disableNotification = false;
            if ($settings) {
                if ($type === 'registration') {
                    $disableNotification = $settings->telegram_sound_registration === false;
                } elseif ($type === 'points') {
                    $disableNotification = $settings->telegram_sound_points === false;
                } elseif ($type === 'reminder') {
                    $disableNotification = $settings->telegram_sound_reminders === false;
                }
            }

            $payload = [
                'chat_id' => $targetChatId,
                'text' => $message,
                'parse_mode' => 'HTML',
                'disable_notification' => (bool)$disableNotification,
            ];

            if ($replyMarkup) {
                $payload['reply_markup'] = json_encode($replyMarkup);
            }

            $response = Http::post($url, $payload);
            $data = $response->json();

            if ($response->failed()) {
                Log::error("Telegram notification failed for tenant {$tenantId} (Target: {$targetChatId}): " . $response->body());
                return null;
            }

            return $data;
        } catch (\Exception $e) {
            Log::error("Telegram notification exception for tenant {$tenantId}: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Send a photo notification to the tenant's Telegram chat or a specific chat ID.
     */
    public function sendPhoto(string $tenantId, ?string $photoUrl, string $caption, string $type = 'points', $replyMarkup = null, ?string $chatId = null): ?array
    {
        $settings = TenantSetting::withoutGlobalScopes()->where('tenant_id', $tenantId)->first();
        $botToken = config('services.telegram.bot_token');

        $targetChatId = $chatId ?: ($settings ? $settings->telegram_chat_id : null);

        if (!$botToken || !$targetChatId) {
            return null;
        }

        try {
            // provides a fallback URL (initials) via $customer->photo_url_full.
            // This ensures consistent UI in Telegram (always photo + caption).
            
            $disableNotification = false;
            if ($settings && $type === 'points') {
                $disableNotification = $settings->telegram_sound_points === false;
            }

            $url = "https://api.telegram.org/bot{$botToken}/sendPhoto";
            
            $payload = [
                'chat_id' => $targetChatId,
                'photo' => $photoUrl,
                'caption' => $caption,
                'parse_mode' => 'HTML',
                'disable_notification' => (bool)$disableNotification,
            ];

            if ($replyMarkup) {
                $payload['reply_markup'] = json_encode($replyMarkup);
            }

            $response = Http::post($url, $payload);
            $data = $response->json();

            if ($response->failed()) {
                // If photo fails, send as text without the debug URL to keep it clean
                Log::error("Telegram photo notification failed for tenant {$tenantId} (Target: {$targetChatId}): " . $response->body());
                return $this->sendMessage($tenantId, $caption, $type, $targetChatId, $replyMarkup);
            }

            return $data;
        } catch (\Exception $e) {
            Log::error("Telegram photo notification exception for tenant {$tenantId}: " . $e->getMessage());
            // Fallback for unexpected exceptions
            return $this->sendMessage($tenantId, $caption, $type, $targetChatId, $replyMarkup);
        }
    }

    /**
     * Send a notification to a specific Chat ID using the central app bot.
     */
    public function sendDirectMessage(string $chatId, string $message, bool $disableNotification = false, $replyMarkup = null): void
    {
        $botToken = config('services.telegram.bot_token');

        if (!$botToken || !$chatId) {
            Log::warning('TelegramService (Direct): Missing bot token or chat ID.', ['chat_id' => $chatId]);
            return;
        }

        try {
            $url = "https://api.telegram.org/bot{$botToken}/sendMessage";
            
            $payload = [
                'chat_id' => $chatId,
                'text' => $message,
                'parse_mode' => 'HTML',
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
        $botToken = config('services.telegram.bot_token');

        if (!$botToken) return;

        try {
            $url = "https://api.telegram.org/bot{$botToken}/editMessageText";
            
            $payload = [
                'chat_id' => $chatId,
                'message_id' => $messageId,
                'text' => $text,
                'parse_mode' => 'HTML', // Ensure we use HTML
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
     * Update an existing Telegram photo caption.
     */
    public function editMessageCaption(string $chatId, int $messageId, string $caption, $replyMarkup = null): void
    {
        $botToken = config('services.telegram.bot_token');

        if (!$botToken) return;

        try {
            $url = "https://api.telegram.org/bot{$botToken}/editMessageCaption";
            
            $payload = [
                'chat_id' => $chatId,
                'message_id' => $messageId,
                'caption' => $caption,
                'parse_mode' => 'HTML',
            ];

            if ($replyMarkup !== null) {
                $payload['reply_markup'] = json_encode($replyMarkup);
            }

            Http::post($url, $payload);
        } catch (\Exception $e) {
            Log::error("Telegram editMessageCaption exception: " . $e->getMessage());
        }
    }

    /**
     * Answer a callback query to stop the loading spinner on the button.
     */
    public function answerCallbackQuery(string $callbackQueryId, string $text = '', bool $showAlert = false): void
    {
        $botToken = config('services.telegram.bot_token');

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
        return htmlspecialchars($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }
}
