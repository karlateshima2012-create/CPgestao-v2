<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\PublicTerminalController;
use App\Http\Controllers\TenantController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Auth
Route::get('/version', function() {
    return response()->json(['version' => '2.2.60', 'time' => now()->toDateTimeString()]);
});

Route::get('/force-migrate', function() {
    try {
        \Illuminate\Support\Facades\Artisan::call('migrate --force');
        return response()->json(['status' => 'success', 'output' => \Illuminate\Support\Facades\Artisan::output()]);
    } catch (\Throwable $e) {
        return response()->json(['error' => $e->getMessage()]);
    }
});

Route::get('/force-process-reminders', function() {
    try {
        \Illuminate\Support\Facades\Artisan::call('app:process-reminders');
        return response()->json(['status' => 'success', 'output' => \Illuminate\Support\Facades\Artisan::output()]);
    } catch (\Throwable $e) {
        return response()->json(['error' => $e->getMessage()]);
    }
});

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
        Route::post('/tenants', [TenantController::class, 'store']);
        Route::patch('/tenants/{id}', [TenantController::class, 'update']);
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
        
        Route::get('/contacts/{id}/reminders', [ClientController::class, 'getContactReminders']);
        Route::post('/contacts/{id}/reminders', [ClientController::class, 'storeContactReminder']);
        Route::delete('/reminders/{id}', [ClientController::class, 'deleteReminder']);
        
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
        Route::patch('/devices/{uid}/toggle-status', [ClientController::class, 'toggleDeviceStatus']);

        Route::get('/loyalty/history', [ClientController::class, 'getLoyaltyHistory']);
        Route::get('/dashboard/metrics', [ClientController::class, 'getDashboardMetrics']);

        // Visit Records (New Registros de Visitas)
        Route::get('/visits', [\App\Http\Controllers\VisitController::class, 'index']);
        Route::post('/visits/{id}/approve', [\App\Http\Controllers\VisitController::class, 'approve']);
        Route::post('/visits/{id}/deny', [\App\Http\Controllers\VisitController::class, 'deny']);
        Route::post('/visits/approve-all', [\App\Http\Controllers\VisitController::class, 'approveAll']);
        // Reports & Insights
        Route::get('/reports/insights', [\App\Http\Controllers\ReportController::class, 'getInsights']);
        Route::get('/reports/export', [\App\Http\Controllers\ReportController::class, 'getExportData']);
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
        Route::post('/photo', [PublicTerminalController::class, 'updatePhoto'])->middleware('throttle:10,1');
        Route::post('/validate-pin', [PublicTerminalController::class, 'validatePin'])->middleware('throttle:10,1');
        Route::post('/earn', [PublicTerminalController::class, 'earn'])->middleware('throttle:20,1');
        Route::post('/auto-earn', [PublicTerminalController::class, 'autoEarn'])->middleware('throttle:20,1');
        Route::post('/redeem', [PublicTerminalController::class, 'redeem'])->middleware('throttle:20,1');
        Route::post('/register', [PublicTerminalController::class, 'register'])->middleware('throttle:10,1');
        Route::get('/point-requests/{requestId}/status', [PublicTerminalController::class, 'getRequestStatus']);
    });

    // Alias endpoints for UID-less operations if called via /p/{slug} in front
    Route::prefix('p/{slug}')->group(function () {
        Route::get('/', [PublicTerminalController::class, 'getInfo']);
        Route::post('/lookup', [PublicTerminalController::class, 'lookup']);
        Route::post('/photo', [PublicTerminalController::class, 'updatePhoto']);
        Route::post('/register', [PublicTerminalController::class, 'register']);
        Route::post('/earn', [PublicTerminalController::class, 'earn']);
        Route::post('/redeem', [PublicTerminalController::class, 'redeem']);
        Route::get('/point-requests/{requestId}/status', [PublicTerminalController::class, 'getRequestStatus']);
    });
});

// Webhooks
Route::post('/webhooks/telegram', [\App\Http\Controllers\Webhooks\TelegramWebhookController::class, 'handle']);
