<?php

namespace App\Http\Controllers;

use App\Models\PointRequest;
use App\Services\PointRequestService;
use Illuminate\Http\Request;
use App\Http\Responses\ApiResponse;
use Illuminate\Support\Facades\Auth;

class PointRequestController extends Controller
{
    protected $pointRequestService;

    public function __construct(PointRequestService $pointRequestService)
    {
        $this->pointRequestService = $pointRequestService;
    }

    /**
     * List pending point requests for the tenant.
     */
    public function index()
    {
        $requests = PointRequest::where('status', 'pending')
            ->orderBy('created_at', 'desc')
            ->get();
            
        return ApiResponse::ok($requests);
    }

    /**
     * Get the count of pending requests for the current tenant.
     */
    public function count()
    {
        $count = PointRequest::where('status', 'pending')->count();
        return ApiResponse::ok(['count' => $count]);
    }

    /**
     * Approve a point request.
     */
    public function approve($id)
    {
        $request = PointRequest::findOrFail($id);

        if ($request->status !== 'pending') {
            return ApiResponse::error('Esta solicitação já foi processada.', 400);
        }

        // Apply points via service
        $this->pointRequestService->applyPoints($request);

        // Update request status
        $request->update([
            'status' => 'approved',
            'approved_by' => Auth::id(),
            'approved_at' => now(),
        ]);

        $this->syncTelegramStatus($request, 'approved');

        event(new \App\Events\PointRequestStatusUpdated($request));

        return ApiResponse::ok($request, 'Solicitação aprovada com sucesso.');
    }

    /**
     * Deny a point request.
     */
    public function deny($id)
    {
        $request = PointRequest::findOrFail($id);

        if ($request->status !== 'pending') {
            return ApiResponse::error('Esta solicitação já foi processada.', 400);
        }

        // Update request status
        $request->update([
            'status' => 'denied',
            'approved_by' => Auth::id(),
            'approved_at' => now(), // Still use approved_at as processed_at
        ]);

        $this->syncTelegramStatus($request, 'denied');

        event(new \App\Events\PointRequestStatusUpdated($request));

        return ApiResponse::ok($request, 'Solicitação recusada.');
    }

    /**
     * Sync status with Telegram message if exists.
     */
    private function syncTelegramStatus($record, $status)
    {
        try {
            $meta = $record->meta ?? [];
            $messageId = $meta['telegram_message_id'] ?? null;
            $chatId = $meta['telegram_chat_id'] ?? null;

            if (!$messageId || !$chatId) return;

            $telegramService = app(\App\Services\TelegramService::class);
            $customer = $record->customer;
            
            if ($status === 'approved') {
                $newText = "<b>Resgate aprovado ✅</b>\n"
                        . "Cliente: <b>{$customer->name}</b>\n"
                        . "Saldo atual: <b>{$customer->points_balance}</b> pontos\n"
                        . "Total de visitas: <b>{$customer->attendance_count}</b>\n\n"
                        . "<i>Status: Processado via Painel Administrativo</i>";

                $markup = [
                    'inline_keyboard' => [
                        [['text' => '✅ APROVADO (PAINEL)', 'callback_data' => 'already_processed']]
                    ]
                ];
                
                if (isset($record->photo_url)) { // If it was a photo message
                     $telegramService->editMessageCaption($chatId, (int)$messageId, $newText, $markup);
                } else {
                     $telegramService->editMessage($chatId, (int)$messageId, $newText, $markup);
                }
            } elseif ($status === 'denied') {
                $newText = "❌ <b>RESGATE RECUSADO</b>\n\n"
                        . "Cliente: <b>{$customer->name}</b>\n"
                        . "<i>Ação realizada via Painel Administrativo</i>";
                $markup = [
                    'inline_keyboard' => [
                        [['text' => '❌ RECUSADO (PAINEL)', 'callback_data' => 'already_processed']]
                    ]
                ];
                $telegramService->editMessageCaption($chatId, (int)$messageId, $newText, $markup);
            }
        } catch (\Exception $e) {
            \Log::warning("Erro ao sincronizar status com Telegram: " . $e->getMessage());
        }
    }
}
