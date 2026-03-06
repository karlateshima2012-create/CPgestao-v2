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
        $tenantId = auth()->user()->tenant_id;
        $query = Visit::where('tenant_id', $tenantId);

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
            
            // Create the visit record
            $visit = Visit::create([
                'tenant_id' => $tenantId,
                'customer_id' => $customer->id,
                'customer_name' => $customer->name,
                'customer_phone' => $customer->phone,
                'customer_company' => $customer->company_name,
                'foto_perfil_url' => $customer->foto_perfil_url,
                'visit_at' => now(),
                'origin' => $request->origin,
                'plan_type' => auth()->user()->tenant->plan,
                'status' => 'aprovado',
                'points_granted' => $request->points,
                'meta' => ['reason' => $request->reason],
                'approved_by' => auth()->id(),
                'approved_at' => now(),
            ]);

            // Apply points to customer
            $service->applyPoints($visit);

            return ApiResponse::ok($visit);
        });
    }
}
