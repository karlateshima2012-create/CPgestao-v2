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
        
        $customers = \App\Models\Customer::where('reminder_date', $today)
            ->whereNotNull('reminder_text')
            ->get();

        if ($customers->isEmpty()) {
            $this->info("Nenhum lembrete para hoje ({$today}).");
            return;
        }

        foreach ($customers as $customer) {
            $message = "🔔 <b>Lembrete de Agendamento</b>\n\n";
            $message .= "<b>Cliente:</b> {$customer->name}\n";
            $message .= "<b>Telefone:</b> {$customer->phone}\n";
            $message .= "<b>Anotação:</b> {$customer->reminder_text}";

            $telegramService->sendMessage($customer->tenant_id, $message);
            
            // Opcional: Limpar o lembrete após enviar? 
            // O usuário disse: "se for marcado dia 22 deve ser notificado dia 22"
            // Vou apenas logar o sucesso.
            $this->info("Lembrete enviado para cliente {$customer->id} do tenant {$customer->tenant_id}");
        }

        $this->info($customers->count() . " lembrete(s) processado(s).");
    }
}
