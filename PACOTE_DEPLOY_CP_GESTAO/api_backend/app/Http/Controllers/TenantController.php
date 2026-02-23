<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Tenant;
use App\Models\TenantSetting;
use App\Services\DeviceService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

use App\Http\Responses\ApiResponse;

class TenantController extends Controller
{
    protected $deviceService;

    public function __construct(DeviceService $deviceService)
    {
        $this->deviceService = $deviceService;
    }

    public function index()
    {
        $tenants = Tenant::withCount('customers')
            ->orderBy('created_at', 'desc')
            ->get();
        return ApiResponse::ok($tenants);
    }

    public function getGlobalMetrics()
    {
        $totalTenants = Tenant::count();
        $totalCards = \App\Models\Device::count();
        $linkedCards = \App\Models\Device::whereNotNull('linked_customer_id')->count();
        
        $expiringSoon = Tenant::whereNotNull('plan_expires_at')
            ->where('plan_expires_at', '>', now())
            ->where('plan_expires_at', '<=', now()->addDays(10))
            ->count();

        return ApiResponse::ok([
            'total_tenants' => $totalTenants,
            'total_cards' => $totalCards,
            'linked_cards' => $linkedCards,
            'expiring_soon' => $expiringSoon,
        ]);
    }

    public function listBatches($id)
    {
        $batches = \App\Models\DeviceBatch::where('tenant_id', $id)
            ->orderBy('created_at', 'desc')
            ->get();
        return ApiResponse::ok($batches);
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string',
            'owner_name' => 'nullable|string',
            'phone' => 'nullable|string',
            'email' => 'required|email',
            'plan' => 'required|string',
            'plan_expires_at' => 'nullable|date',
        ]);

        $tenant = Tenant::create([
            'name' => $request->name,
            'owner_name' => $request->owner_name,
            'phone' => $request->phone,
            'email' => $request->email,
            'plan' => $request->plan,
            'plan_expires_at' => $request->plan_expires_at ?: now()->addDays(30),
            'slug' => Str::slug($request->name),
        ]);

        // Initial PIN: Random 4 digits
        $pin = str_pad(mt_rand(0, 9999), 4, '0', STR_PAD_LEFT);
        $settings = new TenantSetting();
        $settings->tenant_id = $tenant->id;
        $settings->pin = $pin;
        $settings->pin_hash = Hash::make($pin);
        $settings->save();

        // Create initial User (Admin for this tenant)
        $password = Str::random(8);
        $user = User::create([
            'name' => $request->owner_name ?? $request->name,
            'email' => $request->email,
            'password' => Hash::make($password),
            'tenant_id' => $tenant->id,
            'role' => 'client',
            'active' => true,
            'must_change_password' => true,
        ]);

        return ApiResponse::ok([
            'tenant' => $tenant,
            'credentials' => [
                'email' => $user->email,
                'password' => $password
            ]
        ], 'Tenant e usuário criados com sucesso');
    }

    public function update(Request $request, $id)
    {
        $tenant = Tenant::findOrFail($id);
        
        try {
            $validated = $request->validate([
                'name' => 'sometimes|string',
                'owner_name' => 'sometimes|string|nullable',
                'phone' => 'sometimes|string|nullable',
                'email' => 'sometimes|email',
                'status' => 'sometimes|string|in:active,warning,expired,blocked',
                'plan' => 'sometimes|string',
                'plan_expires_at' => 'sometimes|date|nullable',
                'loyalty_active' => 'sometimes|boolean',
                'points_goal' => 'sometimes|integer|min:1',
                'reward_text' => 'sometimes|string',
                'logo_url' => 'sometimes|string|nullable',
                'description' => 'sometimes|string|nullable',
                'renewal_date' => 'sometimes|string|nullable',
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            \Illuminate\Support\Facades\Log::error('Tenant Update Validation Failed', [
                'tenant_id' => $id,
                'errors' => $e->errors(),
                'input' => $request->all()
            ]);
            throw $e;
        }

        // Normalize date format if present to avoid precision issues in database
        if (!empty($validated['plan_expires_at'])) {
            $validated['plan_expires_at'] = \Illuminate\Support\Carbon::parse($validated['plan_expires_at'])->format('Y-m-d');
        }

        $tenant->update($validated);

        return ApiResponse::ok($tenant, 'Loja atualizada com sucesso');
    }

    public function createBatch(Request $request, $id)
    {
        $request->validate([
            'quantity' => 'required|integer|min:1|max:1000',
            'label' => 'nullable|string',
        ]);

        $batch = $this->deviceService->createPremiumBatch($id, $request->quantity, $request->label);
        return ApiResponse::ok($batch, 'Lote gerado com sucesso');
    }

    public function getBatch($id, $batchId)
    {
        $batch = \App\Models\DeviceBatch::where('tenant_id', $id)->findOrFail($batchId);
        $devices = \App\Models\Device::where('batch_id', $batchId)->get();

        return ApiResponse::ok([
            'batch' => $batch,
            'devices' => $devices
        ]);
    }

    public function exportBatch($id, $batchId)
    {
        $tenant = Tenant::findOrFail($id);
        $batch = \App\Models\DeviceBatch::where('tenant_id', $id)->findOrFail($batchId);
        $devices = \App\Models\Device::where('batch_id', $batchId)->get();

        $filename = "batch_{$batchId}_" . now()->format('Y-m-d') . ".csv";
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"$filename\"",
        ];

        $frontendUrl = env('FRONTEND_URL', 'http://localhost:5173');

        $callback = function() use ($devices, $tenant, $frontendUrl) {
            $file = fopen('php://output', 'w');
            fputcsv($file, ['UID', 'Status', 'URL', 'Created At']);

            foreach ($devices as $device) {
                $publicUrl = "{$frontendUrl}/terminal/{$tenant->slug}/{$device->uid}";
                fputcsv($file, [
                    $device->uid,
                    $device->status,
                    $publicUrl,
                    $device->created_at->toDateTimeString(),
                ]);
            }
            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    public function resetPin(Request $request, $id)
    {
        $pin = $request->pin ?: str_pad(mt_rand(0, 9999), 4, '0', STR_PAD_LEFT);
        
        TenantSetting::updateOrCreate(
            ['tenant_id' => $id],
            [
                'pin' => $pin,
                'pin_hash' => Hash::make($pin)
            ]
        );

        return ApiResponse::ok([
            'temp_pin' => $pin
        ], 'PIN atualizado com sucesso');
    }

    public function destroy($id)
    {
        $tenant = Tenant::findOrFail($id);
        
        \Illuminate\Support\Facades\DB::transaction(function() use ($tenant) {
            // Delete associated data
            $tenant->settings()->delete();
            $tenant->loyaltySettings()->delete();
            
            // Delete movements, devices, and customers
            \App\Models\PointMovement::where('tenant_id', $tenant->id)->delete();
            \App\Models\Device::where('tenant_id', $tenant->id)->delete();
            \App\Models\DeviceBatch::where('tenant_id', $tenant->id)->delete();
            \App\Models\Customer::where('tenant_id', $tenant->id)->delete();
            
            // Delete users (all users associated with this tenant)
            $tenant->users()->delete();
            
            // Finally delete the tenant
            $tenant->delete();
        });

        return ApiResponse::ok(null, 'Loja e todos os dados associados foram excluídos com sucesso');
    }
}
