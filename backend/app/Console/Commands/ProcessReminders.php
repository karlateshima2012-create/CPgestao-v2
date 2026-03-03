<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class ProcessReminders extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:process-reminders';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Envia lembretes agendados para o Telegram dos lojistas';

    /**
     * Execute the console command.
     */
    public function handle(\App\Services\TelegramService $telegramService)
    {
        $todayStr = now()->toDateString(); // Y-m-d
        $nowTime = now()->format('H:i');
        
        // Use the new CustomerReminder model
        $reminders = \App\Models\CustomerReminder::where('reminder_date', $todayStr)
            ->where('status', 'pending')
            ->with('customer')
            ->get();

        if ($reminders->isEmpty()) {
            return;
        }

        foreach ($reminders as $reminder) {
            $customer = $reminder->customer;
            if (!$customer) continue;

            $targetTime = !empty($reminder->reminder_time) ? date('H:i', strtotime($reminder->reminder_time)) : '09:00';

            if ($targetTime !== $nowTime) {
                continue;
            }

            $message = "🔔 <b>Lembrete Estratégico</b>\n\n";
            $message .= "<b>Cliente:</b> {$customer->name}\n";
            $message .= "<b>Telefone:</b> {$customer->phone}\n";
            $message .= "<b>Ação:</b> {$reminder->reminder_text}";

            $telegramService->sendMessage($reminder->tenant_id, $message, 'reminder');
            
            // Mark as sent
            $reminder->update(['status' => 'sent']);

            $this->info("Lembrete {$reminder->id} enviado para cliente {$customer->id}");
        }
        $this->info($reminders->count() . " lembrete(s) processado(s).");
    }
}
