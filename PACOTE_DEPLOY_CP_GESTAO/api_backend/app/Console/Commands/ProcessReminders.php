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
        $today = now()->format('d/m/Y');
        $nowTime = now()->format('H:i');
        
        // Busca clientes com lembrete para hoje
        // Se reminder_time estiver definido, deve bater com o horário atual (H:i)
        // Se reminder_time estiver vazio, envia no processamento matinal (a critério do Schedule)
        $customers = \App\Models\Customer::where('reminder_date', $today)
            ->whereNotNull('reminder_text')
            ->get();

        if ($customers->isEmpty()) {
            return;
        }

        foreach ($customers as $customer) {
            $targetTime = !empty($customer->reminder_time) ? $customer->reminder_time : '09:00';

            if ($targetTime !== $nowTime) {
                continue;
            }

            $message = "🔔 <b>Lembrete Estratégico</b>\n\n";
            $message .= "<b>Cliente:</b> {$customer->name}\n";
            $message .= "<b>Telefone:</b> {$customer->phone}\n";
            $message .= "<b>Ação:</b> {$customer->reminder_text}";

            $telegramService->sendMessage($customer->tenant_id, $message, 'reminder');
            
            // Limpa o lembrete para não enviar novamente
            $customer->update([
                'reminder_date' => null,
                'reminder_time' => null,
                'reminder_text' => null,
            ]);

            $this->info("Lembrete enviado e limpo para cliente {$customer->id}");
        }
        $this->info($customers->count() . " lembrete(s) processado(s).");
    }
}
