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
        
        $request->validate([
            'name' => 'sometimes|string',
            'owner_name' => 'sometimes|string|nullable',
            'phone' => 'sometimes|string|nullable',
            'email' => 'sometimes|email',
            'status' => 'sometimes|string|in:active,warning,expired',
            'plan' => 'sometimes|string',
            'plan_expires_at' => 'sometimes|date|nullable',
            'loyalty_active' => 'sometimes|boolean',
            'points_goal' => 'sometimes|integer|min:1',
            'reward_text' => 'sometimes|string',
            'logo_url' => 'sometimes|string|nullable',
            'description' => 'sometimes|string|nullable',
            'renewal_date' => 'sometimes|string|nullable',
        ]);

        $tenant->update($request->all());

        return ApiResponse::ok($tenant, 'Tenant atualizado com sucesso');
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
        $batch = \App\Models\DeviceBatch::where('tenant_id', $id)->findOrFail($batchId);
        $devices = \App\Models\Device::where('batch_id', $batchId)->get();

        $filename = "batch_{$batchId}_" . now()->format('Y-m-d') . ".csv";
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"$filename\"",
        ];

        $callback = function() use ($devices) {
            $file = fopen('php://output', 'w');
            fputcsv($file, ['UID', 'Status', 'Created At']);

            foreach ($devices as $device) {
                fputcsv($file, [
                    $device->uid,
                    $device->status,
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
}
