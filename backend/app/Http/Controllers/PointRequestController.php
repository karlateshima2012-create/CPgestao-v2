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

        event(new \App\Events\PointRequestStatusUpdated($request));

        return ApiResponse::ok($request, 'Solicitação recusada.');
    }
}
