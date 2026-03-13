<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Visit;
use App\Http\Responses\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class ReportController extends Controller
{
    /**
     * Get insights for the lojista.
     */
    public function getInsights(Request $request)
    {
        try {
            $tenantId = auth()->user()->tenant_id;

            // 1. Ranking de clientes com mais pontos
            $topEarnerRank = Customer::where('tenant_id', $tenantId)
                ->orderBy('points_balance', 'desc')
                ->limit(10)
                ->get(['id', 'name', 'phone', 'points_balance', 'loyalty_level']);

            // 2. Clientes Inativos (30, 60, 90 dias)
            $inactive30 = Customer::where('tenant_id', $tenantId)
                ->where('last_activity_at', '<=', now()->subDays(30))
                ->count();
            
            $inactive60 = Customer::where('tenant_id', $tenantId)
                ->where('last_activity_at', '<=', now()->subDays(60))
                ->count();
                
            $inactive90 = Customer::where('tenant_id', $tenantId)
                ->where('last_activity_at', '<=', now()->subDays(90))
                ->count();

            // 3. Distribuição Geográfica (Cidades com mais clientes ativos)
            $geoDistribution = Customer::where('tenant_id', $tenantId)
                ->whereNotNull('city')
                ->where('city', '!=', '')
                ->where('last_activity_at', '>=', now()->subDays(30))
                ->select('city', DB::raw('count(*) as total'))
                ->groupBy('city')
                ->orderBy('total', 'desc')
                ->limit(10)
                ->get();

            return ApiResponse::ok([
                'ranking' => $topEarnerRank,
                'inactive' => [
                    'days_30' => $inactive30,
                    'days_60' => $inactive60,
                    'days_90' => $inactive90,
                ],
                'geo' => $geoDistribution
            ]);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error("Insights Error: " . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'user' => auth()->id()
            ]);
            return response()->json(['ok' => false, 'error' => 'Internal error', 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Get all customers for export, with optional filtering.
     */
    public function getExportData(Request $request)
    {
        $tenantId = auth()->user()->tenant_id;
        $query = Customer::where('tenant_id', $tenantId);

        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function($q) use ($s) {
                $q->where('name', 'like', "%$s%")
                  ->orWhere('email', 'like', "%$s%")
                  ->orWhere('phone', 'like', "%$s%")
                  ->orWhere('city', 'like', "%$s%");
            });
        }

        if ($request->filled('date_from')) {
            $query->where('created_at', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->where('created_at', '<=', $request->date_to);
        }

        // According to requirement: Reflect the current state of CRM without photos
        // We select all columns except prohibited ones
        $prohibited = ['foto_perfil_url', 'password', 'remember_token'];
        $customers = $query->orderBy('name', 'asc')->get();

        $mapped = $customers->map(function($c) use ($prohibited) {
            $data = $c->toArray();
            foreach ($prohibited as $p) {
                unset($data[$p]);
            }
            // Add loyalty level name which is an appends
            $data['loyalty_level_name'] = $c->loyalty_level_name;
            return $data;
        });

        return ApiResponse::ok($mapped);
    }
}
