<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckTenantStatus
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        
        \Illuminate\Support\Facades\Log::debug('Checking status for tenant', ['user' => $user?->id, 'tenant' => $user?->tenant_id]);

        if (!$user || !$user->tenant_id || $user->role !== 'client') {
            return $next($request);
        }

        $tenant = $user->tenant;
        
        if (!$tenant) {
            return $next($request);
        }

        // 1. Check Blocked Status
        if ($tenant->status === 'blocked') {
            return response()->json([
                'ok' => false,
                'error' => 'Acesso Bloqueado',
                'code' => 'TENANT_BLOCKED'
            ], 403);
        }

        // 2. Check Expiration
        if ($tenant->plan_expires_at && \Carbon\Carbon::parse($tenant->plan_expires_at)->isPast()) {
            return response()->json([
                'ok' => false,
                'error' => 'Plano Expirado',
                'code' => 'PLAN_EXPIRED'
            ], 403);
        }

        // 2. Check Contact Limit (Optional: only block creation of new contacts?)
        // The user said: "garanta que limite de contatos atingidos e validade expirada o cliente tenha acesso ao CRM bloqueado"
        // This suggests blocking the WHOLE CRM.
        $limit = \App\Models\Tenant::PLAN_LIMITS[$tenant->plan] ?? 2000;
        $count = $tenant->customers()->count();
        
        if ($count >= $limit) {
             return response()->json([
                'ok' => false,
                'error' => 'Limite Atingido',
                'code' => 'LIMIT_REACHED',
                'current' => $count,
                'limit' => $limit
            ], 403);
        }

        return $next($request);
    }
}
