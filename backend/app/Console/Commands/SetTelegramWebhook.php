<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class SetTelegramWebhook extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'telegram:set-webhook';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Set the Telegram bot webhook URL';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $botToken = config('services.telegram.bot_token');
        $baseUrl = config('app.url', 'https://cpgestao.creativeprintjp.com');
        $webhookUrl = "{$baseUrl}/api/webhooks/telegram";

        $this->info("Setting webhook for bot token: " . substr($botToken, 0, 5) . "...");
        $this->info("Webhook URL: {$webhookUrl}");

        $response = Http::post("https://api.telegram.org/bot{$botToken}/setWebhook", [
            'url' => $webhookUrl
        ]);

        if ($response->successful()) {
            $this->info("Webhook set successfully!");
            $this->line($response->body());
        } else {
            $this->error("Failed to set webhook.");
            $this->line($response->body());
        }
    }
}
