<?php

namespace App\Http\Controllers;

use App\Models\Visit;
use App\Models\Customer;
use App\Models\PointMovement;
use App\Models\TenantSetting;
use App\Services\PointRequestService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Http\Responses\ApiResponse;
use Carbon\Carbon;

class VisitController extends Controller
{
    /**
     * List visits with filters and pagination.
     */
    public function index(Request $request)
    {
        try {
            $tenantId = auth()->user()->tenant_id;
            $query = Visit::with(['customer', 'device'])->where('tenant_id', $tenantId);

            // Filters
            if ($request->has('status') && $request->status !== 'all') {
                $query->where('status', $request->status);
            }

            if ($request->has('period')) {
                $now = now();
                switch ($request->period) {
                    case 'today':
                        $query->whereDate('visit_at', $now->toDateString());
                        break;
                    case '7days':
                        $query->where('visit_at', '>=', $now->subDays(7));
                        break;
                    case '30days':
                        $query->where('visit_at', '>=', $now->subDays(30));
                        break;
                }
            }

            if ($request->has('customer')) {
                $c = $request->customer;
                $query->where(function($q) use ($c) {
                    $q->where('customer_name', 'like', "%{$c}%")
                      ->orWhere('customer_phone', 'like', "%{$c}%");
                });
            }

            $pendingCount = Visit::where('tenant_id', $tenantId)->where('status', 'pendente')->count();

            $visits = $query->orderBy('visit_at', 'desc')->paginate(20);

            return ApiResponse::ok([
                'visits' => $visits,
                'pending_count' => $pendingCount
            ]);
        } catch (\Exception $e) {
            \Log::error('Visit List Error: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);
            return ApiResponse::error('Erro ao listar visitas: ' . $e->getMessage(), 'VISIT_LIST_ERROR', 500);
        }
    }

    /**
     * Approve a pending visit.
     */
    public function approve(Request $request, $id)
    {
        $visit = Visit::where('tenant_id', auth()->user()->tenant_id)->findOrFail($id);

        if ($visit->status !== 'pendente') {
            return ApiResponse::error('Este registro já foi processado.', 'ALREADY_PROCESSED', 400);
        }

        return DB::transaction(function () use ($visit) {
            $service = new PointRequestService();
            $service->applyPoints($visit);

            // Update Visit
            $visit->update([
                'status' => 'aprovado',
                'approved_by' => auth()->id(),
                'approved_at' => now()
            ]);

            $this->syncTelegramStatus($visit, 'approved');

            return ApiResponse::ok($visit);
        });
    }

    /**
     * Deny a pending visit.
     */
    public function deny(Request $request, $id)
    {
        $visit = Visit::where('tenant_id', auth()->user()->tenant_id)->findOrFail($id);

        if ($visit->status !== 'pendente') {
            return ApiResponse::error('Este registro já foi processado.', 'ALREADY_PROCESSED', 400);
        }

        $visit->update([
            'status' => 'negado',
            'approved_by' => auth()->id(),
            'approved_at' => now()
        ]);

        $this->syncTelegramStatus($visit, 'denied');

        return ApiResponse::ok($visit);
    }

    /**
     * Approve all pending visits in the current filter (scoped to tenant).
     */
    public function approveAll(Request $request)
    {
        $tenantId = auth()->user()->tenant_id;
        $pendingVisits = Visit::where('tenant_id', $tenantId)
            ->where('status', 'pendente')
            ->get();

        if ($pendingVisits->isEmpty()) {
            return ApiResponse::ok(['message' => 'Nenhuma solicitação pendente.']);
        }

        return DB::transaction(function () use ($pendingVisits) {
            $service = new PointRequestService();
            foreach ($pendingVisits as $visit) {
                $service->applyPoints($visit);

                $visit->update([
                    'status' => 'aprovado',
                    'approved_by' => auth()->id(),
                    'approved_at' => now()
                ]);

                $this->syncTelegramStatus($visit, 'approved');
            }

            return ApiResponse::ok(['message' => count($pendingVisits) . ' visitas aprovadas com sucesso.']);
        });
    }

    /**
     * Create a manual visit / point adjustment from the CRM.
     */
    public function storeManual(Request $request)
    {
        $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'points' => 'required|integer',
            'origin' => 'required|string',
            'reason' => 'nullable|string'
        ]);

        $tenantId = auth()->user()->tenant_id;
        $customer = Customer::where('tenant_id', $tenantId)->findOrFail($request->customer_id);

        return DB::transaction(function () use ($request, $tenantId, $customer) {
            $service = new PointRequestService();
            
            // Create the visit record with safety catch
            try {
                $visit = Visit::create([
                    'tenant_id' => $tenantId,
                    'customer_id' => $customer->id,
                    'customer_name' => $customer->name,
                    'customer_phone' => $customer->phone,
                    'customer_company' => $customer->company_name,
                    'foto_perfil_url' => $customer->foto_perfil_url,
                    'visit_at' => now(),
                    'origin' => $request->origin,
                    'plan_type' => auth()->user()->tenant?->plan ?? 'pro',
                    'status' => 'aprovado',
                    'points_granted' => (int)$request->points,
                    'meta' => ['reason' => $request->reason],
                    'approved_by' => auth()->id(),
                    'approved_at' => now(),
                ]);
            } catch (\Exception $e) {
                \Log::error("CRITICAL: Manual Visit Create Failed, applying minimal fallback: " . $e->getMessage());
                // Minimal create if first one fails - Only fields guaranteed by all versions
                $visit = Visit::create([
                    'tenant_id' => $tenantId,
                    'customer_id' => $customer->id,
                    'customer_name' => $customer->name,
                    'customer_phone' => $customer->phone,
                    'visit_at' => now(),
                    'points_granted' => (int)$request->points,
                ]);
            }

            // Apply points to customer
            $service->applyPoints($visit);

            return ApiResponse::ok($visit);
        });
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
                $newText = "<b>Ponto aprovado ✅</b>\n"
                        . "Cliente: <b>{$customer->name}</b>\n"
                        . "Saldo atual: <b>{$customer->points_balance}</b> pontos\n"
                        . "Total de visitas: <b>{$customer->attendance_count}</b>\n\n"
                        . "<i>Status: Processado via Painel Administrativo</i>";

                $markup = [
                    'inline_keyboard' => [
                        [['text' => '✅ APROVADO (PAINEL)', 'callback_data' => 'already_processed']]
                    ]
                ];
                
                $telegramService->editMessageCaption($chatId, (int)$messageId, $newText, $markup);
            } elseif ($status === 'denied') {
                $newText = "❌ <b>SOLICITAÇÃO RECUSADA</b>\n\n"
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
