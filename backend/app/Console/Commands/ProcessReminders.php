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
        
        // Buscar todos os lembretes pendentes para hoje ou datas passadas que ainda NÃO foram enviados
        // Usamos withoutGlobalScopes para garantir que o comando pegue todos de todos os tenants
        $reminders = \App\Models\CustomerReminder::withoutGlobalScopes()
            ->where('status', 'pending')
            ->where(function($query) use ($todayStr, $nowTime) {
                $query->where('reminder_date', '<', $todayStr)
                      ->orWhere(function($q) use ($todayStr, $nowTime) {
                          $q->where('reminder_date', $todayStr)
                            ->where('reminder_time', '<=', $nowTime . ':59');
                      });
            })
            ->with(['customer', 'tenant'])
            ->get();

        if ($reminders->isEmpty()) {
            return;
        }

        foreach ($reminders as $reminder) {
            $customer = $reminder->customer;
            if (!$customer) continue;

            // Escapar dados para o HTML do Telegram
            $escName = \App\Services\TelegramService::escapeMarkdownV2($customer->name);
            $escPhone = \App\Services\TelegramService::escapeMarkdownV2($customer->phone ?? 'Não informado');
            $escText = \App\Services\TelegramService::escapeMarkdownV2($reminder->reminder_text);
            $escDate = \App\Services\TelegramService::escapeMarkdownV2(date('d/m/Y', strtotime($reminder->reminder_date)));
            $escTime = \App\Services\TelegramService::escapeMarkdownV2(date('H:i', strtotime($reminder->reminder_time)));

            $message = "🔔 <b>Lembrete Estratégico</b>\n\n";
            $message .= "<b>Cliente:</b> {$escName}\n";
            $message .= "<b>Telefone:</b> {$escPhone}\n";
            $message .= "<b>Data/Hora:</b> {$escDate} às {$escTime}\n\n";
            $message .= "<b>Ação:</b> {$escText}";

            $telegramService->sendMessage($reminder->tenant_id, $message, 'reminder');
            
            // Mark as sent
            $reminder->update(['status' => 'sent']);

            $this->info("Lembrete {$reminder->id} enviado para cliente {$customer->id}");
        }
        $this->info($reminders->count() . " lembrete(s) processado(s).");
    }
}
