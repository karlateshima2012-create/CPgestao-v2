<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class SendTelegramNotificationJob implements ShouldQueue
{
    use Queueable;

    protected $tenantId;
    protected $message;
    protected $type;
    protected $chatId;
    protected $replyMarkup;
    protected $photoUrl;

    /**
     * Create a new job instance.
     */
    public function __construct(string $tenantId, string $message, string $type = 'registration', ?string $chatId = null, $replyMarkup = null, ?string $photoUrl = null)
    {
        $this->tenantId = $tenantId;
        $this->message = $message;
        $this->type = $type;
        $this->chatId = $chatId;
        $this->replyMarkup = $replyMarkup;
        $this->photoUrl = $photoUrl;
    }

    /**
     * Execute the job.
     */
    public function handle(\App\Services\TelegramService $telegramService): void
    {
        if ($this->photoUrl) {
            $telegramService->sendPhoto(
                $this->tenantId, 
                $this->photoUrl, 
                $this->message, 
                $this->type, 
                $this->replyMarkup, 
                $this->chatId
            );
        } else {
            $telegramService->sendMessage(
                $this->tenantId, 
                $this->message, 
                $this->type, 
                $this->chatId, 
                $this->replyMarkup
            );
        }
    }
}
