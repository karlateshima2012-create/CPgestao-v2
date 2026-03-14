<?php

namespace App\Http\Controllers\Webhooks;

use App\Http\Controllers\Controller;
use App\Models\PointRequest;
use App\Services\PointRequestService;
use App\Services\TelegramService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class TelegramWebhookController extends Controller
{
    protected $pointRequestService;
    protected $telegramService;

    public function __construct(PointRequestService $pointRequestService, TelegramService $telegramService)
    {
        $this->pointRequestService = $pointRequestService;
        $this->telegramService = $telegramService;
    }

    /**
     * Handle incoming Telegram Webhook.
     */
    public function handle(Request $request)
    {
        $update = $request->all();
        Log::info('Incoming Telegram Update', ['payload' => $update]);

        if (isset($update['callback_query'])) {
            return $this->handleCallbackQuery($update['callback_query']);
        }

        if (isset($update['message'])) {
            return $this->handleMessage($update['message']);
        }

        return response()->json(['status' => 'ignored']);
    }

    /**
     * Handle incoming text messages.
     */
    private function handleMessage($message)
    {
        $chatId = $message['chat']['id'];
        $text = $message['text'] ?? '';

        if (strpos($text, '/start') === 0) {
            $escChatId = TelegramService::escapeMarkdownV2((string)$chatId);
            $response = "Olá\! Bem\-vindo ao assistente do *CPgestão Fidelidade* 🚀\.\n\n" .
                        "🆔 Seu Chat ID: `{$escChatId}` \n\n" .
                        "📍 *O que fazer agora?*\n" .
                        "1️⃣ Copie o número acima\.\n" .
                        "2️⃣ Vá até o seu painel em *Gerenciar Dispositivos*\.\n" .
                        "3️⃣ No Totem desejado, cole esse número no campo *ID*\.\n\n" .
                        "Pronto\! Agora você receberá as notificações por aqui\. ⚡";

            $this->telegramService->sendDirectMessage($chatId, $response);
            return response()->json(['status' => 'start_handled']);
        }

        return response()->json(['status' => 'message_ignored']);
    }

    /**
     * Handle Callback Queries (Buttons).
     */
    private function handleCallbackQuery($callbackQuery)
    {
        $callbackQueryId = $callbackQuery['id'];
        $data = $callbackQuery['data'];
        $chatId = $callbackQuery['message']['chat']['id'];
        $messageId = $callbackQuery['message']['message_id'];
        $originalText = $callbackQuery['message']['text'] ?? $callbackQuery['message']['caption'] ?? '';
        
        // Se já tiver "Ponto aprovado" ou similar no texto, evitamos duplicar o histórico se for re-aprovado
        $originalText = preg_replace('/(?i)(Ponto aprovado|SOLICITAÇÃO RECUSADA).*$/s', '', $originalText);
        $originalText = trim($originalText);

        if (strpos($data, 'approve_visit:') === 0) {
            $visitId = str_replace('approve_visit:', '', $data);
            return $this->processVisit($visitId, 'approved', $chatId, $messageId, $originalText, $callbackQueryId, $callbackQuery);
        }

        if (strpos($data, 'reject_visit:') === 0) {
            $visitId = str_replace('reject_visit:', '', $data);
            return $this->processVisit($visitId, 'denied', $chatId, $messageId, $originalText, $callbackQueryId, $callbackQuery);
        }

        if (strpos($data, 'approve_request:') === 0) {
            $requestId = str_replace('approve_request:', '', $data);
            return $this->processRequest($requestId, 'approved', $chatId, $messageId, $originalText, $callbackQueryId, $callbackQuery);
        }

        if (strpos($data, 'reject_request:') === 0) {
            $requestId = str_replace('reject_request:', '', $data);
            return $this->processRequest($requestId, 'denied', $chatId, $messageId, $originalText, $callbackQueryId, $callbackQuery);
        }

        if ($data === 'already_processed') {
            $this->telegramService->answerCallbackQuery($callbackQueryId, "ℹ️ Já processada.");
            return response()->json(['status' => 'already_processed']);
        }

        return response()->json(['status' => 'data_ignored']);
    }

    /**
     * Process the visit approval or rejection.
     */
    private function processVisit($visitId, $action, $chatId, $messageId, $originalText, $callbackQueryId, $callbackQuery)
    {
        $visit = \App\Models\Visit::find($visitId);

        if (!$visit) {
            $this->telegramService->answerCallbackQuery($callbackQueryId, "❌ Erro: Visita não encontrada.", true);
            return response()->json(['status' => 'not_found']);
        }

        if ($visit->status !== 'pendente') {
            $statusLabel = $visit->status === 'aprovado' ? 'Aprovada' : 'Recusada';
            $this->telegramService->answerCallbackQuery($callbackQueryId, "ℹ️ Já processada: {$statusLabel}");
            return response()->json(['status' => 'already_processed']);
        }

        // Security check: Validate if the Chat ID is authorized
        $settings = \App\Models\TenantSetting::where('tenant_id', $visit->tenant_id)->first();
        $authorizedId = $settings ? $settings->telegram_chat_id : null;

        if ($authorizedId && (string)$chatId !== (string)$authorizedId) {
            $this->telegramService->answerCallbackQuery($callbackQueryId, "⚠️ Acesso negado.", true);
            return response()->json(['status' => 'unauthorized'], 403);
        }

        $this->telegramService->answerCallbackQuery($callbackQueryId, $action === 'approved' ? "✅ Ponto Aprovado!" : "❌ Ponto Recusado!");

        if ($action === 'approved') {
            \Illuminate\Support\Facades\DB::transaction(function() use ($visit) {
                $customer = $visit->customer;
                
                // Use the PointRequestService to apply points consistently
                // This handles level upgrades, movements, and correctly respects points_granted
                $service = app(\App\Services\PointRequestService::class);
                $service->applyPoints($visit);

                $visit->update([
                    'status' => 'aprovado',
                    'approved_at' => now()
                ]);
            });

            $customer = $visit->customer->fresh();
            $newText = "<b>Ponto aprovado ✅</b>\n"
                     . "Cliente agora possui <b>{$customer->points_balance}</b> pontos\n"
                     . "Total de visitas: <b>{$customer->attendance_count}</b>\n\n"
                     . "--- Dados da Solicitação ---\n"
                     . $originalText;

            $markup = [
                'inline_keyboard' => [
                    [['text' => '✅ APROVADO', 'callback_data' => 'already_processed']]
                ]
            ];
            if (isset($callbackQuery['message']['photo'])) {
                $this->telegramService->editMessageCaption($chatId, $messageId, $newText, $markup);
            } else {
                $this->telegramService->editMessage($chatId, $messageId, $newText, $markup);
            }
        } else {
            $visit->update([
                'status' => 'negado',
                'approved_at' => now()
            ]);

            $newText = "❌ <b>SOLICITAÇÃO RECUSADA</b>\n\n"
                     . "--- Dados da Solicitação ---\n"
                     . $originalText;
            $markup = [
                'inline_keyboard' => [
                    [['text' => '❌ RECUSADO', 'callback_data' => 'already_processed']]
                ]
            ];
            if (isset($callbackQuery['message']['photo'])) {
                $this->telegramService->editMessageCaption($chatId, $messageId, $newText, $markup);
            } else {
                $this->telegramService->editMessage($chatId, $messageId, $newText, $markup);
            }
        }

        return response()->json(['status' => 'success']);
    }

    /**
     * Process the approval or rejection.
     */
    private function processRequest($requestId, $action, $chatId, $messageId, $originalText, $callbackQueryId, $callbackQuery)
    {
        // Answer eventually if not answered already, but better to answer after checking auth
        
        $request = PointRequest::find($requestId);

        if (!$request) {
            $this->telegramService->answerCallbackQuery($callbackQueryId, "❌ Erro: Solicitação não encontrada.", true);
            $this->telegramService->editMessage($chatId, $messageId, $originalText . "\n\n❌ <b>Erro: Solicitação não encontrada.</b>");
            return response()->json(['status' => 'not_found']);
        }

        if ($request->status !== 'pending') {
            $statusLabel = $request->status === 'approved' ? 'Aprovada' : 'Recusada';
            $this->telegramService->answerCallbackQuery($callbackQueryId, "ℹ️ Já processada: {$statusLabel}");
            $this->telegramService->editMessage($chatId, $messageId, $originalText . "\n\nℹ️ <b>Esta solicitação já foi {$statusLabel}.</b>");
            return response()->json(['status' => 'already_processed']);
        }

        // Security check: Validate if the Chat ID is authorized for this totem
        $device = $request->device;
        $authorizedId = $device ? $device->telegram_chat_id : null;
        
        // If device has no ID, fallback to Tenant Settings
        if (!$authorizedId) {
            $settings = \App\Models\TenantSetting::where('tenant_id', $request->tenant_id)->first();
            $authorizedId = $settings ? $settings->telegram_chat_id : null;
        }

        if ($authorizedId && (string)$chatId !== (string)$authorizedId) {
            Log::warning("Unauthorized Telegram approval attempt for request {$requestId} from chat {$chatId}. Expected {$authorizedId}.");
            $this->telegramService->answerCallbackQuery($callbackQueryId, "⚠️ Acesso negado. Você não tem permissão para esta ação.", true);
            return response()->json(['status' => 'unauthorized'], 403);
        }

        // Answer now to stop spinner and give feedback
        $this->telegramService->answerCallbackQuery($callbackQueryId, $action === 'approved' ? "✅ Ponto Aprovado!" : "❌ Ponto Recusado!");

        if ($action === 'approved') {
            $this->pointRequestService->applyPoints($request);
            $request->update([
                'status' => 'approved',
                'approved_at' => now(),
            ]);

            $customer = $request->customer;
            $newText = "<b>Ponto aprovado ✅</b>\n"
                     . "Cliente agora possui <b>{$customer->points_balance}</b> pontos\n"
                     . "Total de visitas: <b>{$customer->attendance_count}</b>\n\n"
                     . "--- Dados da Solicitação ---\n"
                     . $originalText;

            $markup = [
                'inline_keyboard' => [
                    [['text' => '✅ APROVADO', 'callback_data' => 'already_processed']]
                ]
            ];

            if (isset($callbackQuery['message']['photo'])) {
                $this->telegramService->editMessageCaption($chatId, $messageId, $newText, $markup);
            } else {
                $this->telegramService->editMessage($chatId, $messageId, $newText, $markup);
            }
        } else {
            $request->update([
                'status' => 'denied',
                'approved_at' => now(),
            ]);

            $newText = "❌ <b>SOLICITAÇÃO RECUSADA</b>\n\n"
                     . "--- Dados da Solicitação ---\n"
                     . $originalText;
            
            $markup = [
                'inline_keyboard' => [
                    [['text' => '❌ RECUSADO', 'callback_data' => 'already_processed']]
                ]
            ];

            if (isset($callbackQuery['message']['photo'])) {
                $this->telegramService->editMessageCaption($chatId, $messageId, $newText, $markup);
            } else {
                $this->telegramService->editMessage($chatId, $messageId, $newText, $markup);
            }
        }

        // Fire Broadcast Event for real-time UI updates (Public Terminal & Admin)
        event(new \App\Events\PointRequestStatusUpdated($request));

        return response()->json(['status' => 'success']);
    }
}
