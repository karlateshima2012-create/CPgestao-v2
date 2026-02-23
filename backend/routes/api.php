<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\PublicTerminalController;
use App\Http\Controllers\TenantController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Auth
Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword']);
Route::post('/auth/reset-password', [AuthController::class, 'resetPassword']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/auth/change-password', [AuthController::class, 'changePassword']);
    Route::post('/auth/complete-onboarding', [AuthController::class, 'completeOnboarding']);

    // =========================================================================
    // ADMIN GROUP (Super Admin)
    // Protection: auth:sanctum + role:admin
    // =========================================================================
    Route::prefix('admin')->middleware('role:admin')->group(function () {
        Route::get('/tenants', [TenantController::class, 'index']);
        Route::get('/tenants/{id}/premium-batches', [TenantController::class, 'listBatches']);
        Route::post('/tenants', [TenantController::class, 'store']);
        Route::patch('/tenants/{id}', [TenantController::class, 'update']);
        Route::post('/tenants/{id}/premium-batches', [TenantController::class, 'createBatch']);
        Route::get('/tenants/{id}/premium-batches/{batchId}', [TenantController::class, 'getBatch']);
        Route::get('/tenants/{id}/premium-batches/{batchId}/export', [TenantController::class, 'exportBatch']);
        Route::get('/tenants/{id}/devices', [TenantController::class, 'listDevices']);
        Route::post('/tenants/{id}/devices', [TenantController::class, 'storeDevice']);
        Route::put('/tenants/{id}/devices/{deviceId}', [TenantController::class, 'updateDevice']);
        Route::delete('/tenants/{id}/devices/{deviceId}', [TenantController::class, 'deleteDevice']);
        Route::post('/tenants/{id}/pin-reset', [TenantController::class, 'resetPin']);
        Route::delete('/tenants/{id}', [TenantController::class, 'destroy']);
        Route::get('/metrics', [TenantController::class, 'getGlobalMetrics']);
    });

    // =========================================================================
    // CLIENT GROUP (Lojista)
    // Protection: auth:sanctum + role:client
    // Multi-tenancy: Scoped by user()->tenant_id in controllers
    // =========================================================================
    Route::prefix('client')->middleware(['role:client', 'tenant.status'])->group(function () {
        Route::get('/contacts', [ClientController::class, 'getContacts']);
        Route::get('/contacts/{id}', [ClientController::class, 'getContact']);
        Route::post('/contacts', [ClientController::class, 'storeContact']);
        Route::patch('/contacts/{id}', [ClientController::class, 'updateContact']);
        Route::delete('/contacts/{id}', [ClientController::class, 'deleteContact']);

        Route::get('/contacts/{id}/service-records', [\App\Http\Controllers\ServiceRecordController::class, 'index']);
        Route::post('/contacts/{id}/service-records', [\App\Http\Controllers\ServiceRecordController::class, 'store']);
        
        Route::get('/loyalty/settings', [ClientController::class, 'getLoyaltySettings']);
        Route::patch('/loyalty/settings', [ClientController::class, 'updateLoyaltySettings']);
        Route::get('/settings', [ClientController::class, 'getAccountSettings']);
        Route::patch('/settings', [ClientController::class, 'updateAccountSettings']);
        Route::patch('/pin', [ClientController::class, 'updatePin']);
        
        Route::get('/tags', [\App\Http\Controllers\TagController::class, 'index']);
        Route::post('/tags', [\App\Http\Controllers\TagController::class, 'store']);
        Route::delete('/tags/{id}', [\App\Http\Controllers\TagController::class, 'destroy']);
        
        Route::get('/devices', [ClientController::class, 'getDevices']);
        Route::post('/devices', [ClientController::class, 'storeDevice']);
        Route::put('/devices/{deviceId}', [ClientController::class, 'updateDevice']);
        Route::delete('/devices/{deviceId}', [ClientController::class, 'deleteDevice']);
        Route::get('/premium-batches', [ClientController::class, 'getPremiumBatches']);
        Route::get('/premium-batches/{id}', [ClientController::class, 'getPremiumBatch']);
        Route::get('/premium-batches/{batchId}/cards', [ClientController::class, 'getPremiumBatchCards']);
        Route::post('/devices/premium/link', [ClientController::class, 'linkDevice']);
        Route::post('/devices/premium/unlink', [ClientController::class, 'unlinkDevice']);
        Route::post('/devices/premium/disable', [ClientController::class, 'disablePremiumCard']);
        Route::patch('/devices/{uid}/toggle-status', [ClientController::class, 'toggleDeviceStatus']);

        Route::get('/loyalty/history', [ClientController::class, 'getLoyaltyHistory']);
        Route::get('/dashboard/metrics', [ClientController::class, 'getDashboardMetrics']);

        // Point Requests
        Route::get('/point-requests', [\App\Http\Controllers\PointRequestController::class, 'index']);
        Route::get('/point-requests/count', [\App\Http\Controllers\PointRequestController::class, 'count']);
        Route::post('/point-requests/{id}/approve', [\App\Http\Controllers\PointRequestController::class, 'approve']);
        Route::post('/point-requests/{id}/deny', [\App\Http\Controllers\PointRequestController::class, 'deny']);
    });

    Route::post('/auth/logout', [AuthController::class, 'logout']);
});

// =========================================================================
// PUBLIC TERMINAL
// Protection: Throttling + Device Validation + PIN Hash Checking
// =========================================================================
Route::prefix('public')->group(function () {
    Route::get('/p/{slug}', [PublicTerminalController::class, 'getStoreInfo']);
    
    Route::prefix('terminal/{slug}/{uid}')->group(function () {
        Route::get('/', [PublicTerminalController::class, 'getInfo']);
        Route::post('/lookup', [PublicTerminalController::class, 'lookup'])->middleware('throttle:30,1');
        Route::post('/validate-pin', [PublicTerminalController::class, 'validatePin'])->middleware('throttle:10,1');
        Route::post('/earn', [PublicTerminalController::class, 'earn'])->middleware('throttle:20,1');
        Route::post('/auto-earn', [PublicTerminalController::class, 'autoEarn'])->middleware('throttle:20,1');
        Route::post('/redeem', [PublicTerminalController::class, 'redeem'])->middleware('throttle:20,1');
        Route::post('/register', [PublicTerminalController::class, 'register'])->middleware('throttle:10,1');
        Route::post('/link-vip', [PublicTerminalController::class, 'linkVip'])->middleware('throttle:10,1');
    });

    // Alias endpoints for UID-less operations if called via /p/{slug} in front
    Route::prefix('p/{slug}')->group(function () {
        Route::post('/lookup', [PublicTerminalController::class, 'lookup']);
        Route::post('/register', [PublicTerminalController::class, 'register']);
    });
});

// =========================================================================
// VIP CARD NFC ROUTES
// =========================================================================
Route::prefix('vip')->group(function () {
    // Resolve owner vs public without enforcing auth block
    Route::get('/resolve/{uid}', [\App\Http\Controllers\VipCardController::class, 'resolve']);
    
    // Add point is explicitely protected
    Route::post('/point/{uid}', [\App\Http\Controllers\VipCardController::class, 'addPoint'])
        ->middleware(['auth:sanctum', 'role:client']);
});
