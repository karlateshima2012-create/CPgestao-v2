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
        // Remover a linha de "Visitas" do texto original para não ficar duplicado (já mostramos o novo saldo acima)
        $originalText = preg_replace('/^Visitas:.*$/m', '', $originalText);
        $originalText = preg_replace('/^<b>Visitas:<\/b>.*$/m', '', $originalText);
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

        if (strpos($data, 'redeem_reward:') === 0) {
            $customerId = str_replace('redeem_reward:', '', $data);
            return $this->handleRedeemReward($customerId, $chatId, $messageId, $callbackQueryId, $callbackQuery);
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

    /**
     * Handle Manual Reward Redemption from Telegram.
     */
    private function handleRedeemReward($customerId, $chatId, $messageId, $callbackQueryId, $callbackQuery)
    {
        $customer = \App\Models\Customer::find($customerId);
        if (!$customer) {
            $this->telegramService->answerCallbackQuery($callbackQueryId, "❌ Erro: Cliente não encontrado.", true);
            return response()->json(['status' => 'not_found']);
        }

        $tenantId = $customer->tenant_id;
        $loyalty = \App\Models\LoyaltySetting::where('tenant_id', $tenantId)->first();
        if (!$loyalty) {
            $this->telegramService->answerCallbackQuery($callbackQueryId, "❌ Erro: Fidelidade não configurada.", true);
            return response()->json(['status' => 'error']);
        }

        $levelsConfig = $loyalty->levels_config;
        $currentLevel = (int)($customer->loyalty_level ?? 1);
        
        // Get Goal
        $settings = \App\Models\TenantSetting::where('tenant_id', $tenantId)->first();
        $goal = 10; // Default
        if ($settings && $settings->points_goal) $goal = (int)$settings->points_goal;
        
        $lvlIdx = max(0, $currentLevel - 1);
        if (is_array($levelsConfig) && isset($levelsConfig[$lvlIdx])) {
            $goal = (int)($levelsConfig[$lvlIdx]['goal'] ?? $goal);
        }

        if ($customer->points_balance < $goal) {
            $this->telegramService->answerCallbackQuery($callbackQueryId, "⚠️ Saldo insuficiente ({$customer->points_balance}/{$goal}).", true);
            return response()->json(['status' => 'insufficient_points']);
        }

        // Apply reward
        try {
            \Illuminate\Support\Facades\DB::transaction(function() use ($customer, $loyalty, $goal, $currentLevel, $levelsConfig) {
                $nextLevelIdx = $currentLevel; 
                $pointsToAdd = (int)($loyalty->regular_points_per_scan ?? 1);
                
                if (is_array($levelsConfig) && isset($levelsConfig[$nextLevelIdx]) && isset($levelsConfig[$nextLevelIdx]['points_per_visit'])) {
                    $pointsToAdd = (int) $levelsConfig[$nextLevelIdx]['points_per_visit'];
                }

                // Create a mock request for applyPoints
                $mockRequest = (object)[
                    'tenant_id' => $customer->tenant_id,
                    'customer_id' => $customer->id,
                    'requested_points' => $pointsToAdd,
                    'id' => 'redeem_telegram_' . uniqid(),
                    'source' => 'telegram_remote_manual',
                    'meta' => [
                        'is_redemption' => true,
                        'goal' => $goal
                    ]
                ];

                $service = app(\App\Services\PointRequestService::class);
                $service->applyPoints($mockRequest);
            });

            $customer = $customer->fresh();
            $this->telegramService->answerCallbackQuery($callbackQueryId, "🏆 RECOMPENSA ENTREGUE! 🏆");

            $originalText = $callbackQuery['message']['text'] ?? $callbackQuery['message']['caption'] ?? '';
            $newText = "🏆 <b>RECOMPENSA ENTREGUE!</b> 🏆\n"
                     . "Cliente: <b>{$customer->name}</b>\n"
                     . "Novo nível: <b>{$customer->loyalty_level_name}</b>\n"
                     . "Ponto inicial: <b>{$customer->points_balance}</b>\n\n"
                     . "<i>Ação realizada via Telegram</i>\n\n"
                     . $originalText;

            $markup = [
                'inline_keyboard' => [
                    [['text' => '🏆 PREMIADO (VIA TELEGRAM)', 'callback_data' => 'already_processed']]
                ]
            ];

            if (isset($callbackQuery['message']['photo'])) {
                $this->telegramService->editMessageCaption($chatId, $messageId, $newText, $markup);
            } else {
                $this->telegramService->editMessage($chatId, $messageId, $newText, $markup);
            }

            return response()->json(['status' => 'success']);
        } catch (\Exception $e) {
            Log::error('Telegram Redemption Error: ' . $e->getMessage());
            $this->telegramService->answerCallbackQuery($callbackQueryId, "❌ Erro ao processar: " . $e->getMessage(), true);
            return response()->json(['status' => 'error']);
        }
    }
}
