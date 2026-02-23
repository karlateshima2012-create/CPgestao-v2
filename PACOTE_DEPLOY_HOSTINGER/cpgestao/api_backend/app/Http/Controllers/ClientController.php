<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Device;
use App\Models\DeviceBatch;
use App\Models\TenantSetting;
use App\Services\DeviceService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Exception;

use App\Http\Responses\ApiResponse;
use App\Utils\PhoneHelper;
use App\Services\TelegramService;
use Illuminate\Support\Facades\DB;

class ClientController extends Controller
{
    protected $deviceService;
    protected $telegramService;

    public function __construct(DeviceService $deviceService, TelegramService $telegramService)
    {
        $this->deviceService = $deviceService;
        $this->telegramService = $telegramService;
    }

    public function getContacts(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $contacts = Customer::where('tenant_id', $tenantId)
            ->with(['devices' => function($q) {
                $q->where('status', 'linked')->where('type', 'premium');
            }])
            ->orderBy('created_at', 'desc')
            ->get();
        return ApiResponse::ok($contacts);
    }

    public function storeContact(Request $request)
    {
        $request->validate([
            'name' => 'required|string',
            'phone' => 'required|string',
            'city' => 'required|string',
            'points_balance' => 'sometimes|integer',
            'is_premium' => 'sometimes|boolean',
        ]);

        $tenantId = $request->user()->tenant_id;

        $phone = PhoneHelper::normalize($request->phone);
        if (Customer::where('tenant_id', $tenantId)->where('phone', $phone)->exists()) {
            return ApiResponse::error('Este número de telefone já está cadastrado nesta loja.', 'DUPLICATE_PHONE', 409);
        }

        $customer = Customer::create([
            'tenant_id' => $tenantId,
            'name' => $request->name,
            'phone' => $phone,
            'email' => $request->email,
            'city' => $request->city,
            'province' => $request->province,
            'is_premium' => $request->is_premium ?? false,
            'points_balance' => $request->points_balance ?? 0,
            'source' => 'crm',
            'last_activity_at' => now(),
            'notes' => $request->notes,
            'last_contacted' => $request->last_contacted,
            'reminder_date' => $request->reminder_date,
            'reminder_text' => $request->reminder_text,
        ]);

        if ($customer->points_balance > 0) {
            \App\Models\PointMovement::create([
                'tenant_id' => $tenantId,
                'customer_id' => $customer->id,
                'type' => 'earn',
                'points' => $customer->points_balance,
                'origin' => 'crm_manual',
                'description' => 'Saldo inicial via CRM'
            ]);
        }

        $this->telegramService->sendMessage($tenantId, "👤 <b>Novo Cliente Cadastrado (CRM)</b>\n\n<b>Nome:</b> {$customer->name}\n<b>Telefone:</b> {$customer->phone}");

        $customer->load(['devices' => function($q) {
            $q->where('status', 'linked')->where('type', 'premium');
        }]);

        return ApiResponse::ok($customer, 'Contato criado com sucesso');
    }

    public function updateContact(Request $request, $id)
    {
        $tenantId = $request->user()->tenant_id;
        $customer = Customer::where('tenant_id', $tenantId)->findOrFail($id);

        $request->validate([
            'name' => 'sometimes|string',
            'phone' => 'sometimes|string',
            'email' => 'sometimes|email|nullable',
            'is_premium' => 'sometimes|boolean',
            'points_balance' => 'sometimes|integer',
        ]);

        if ($request->has('phone')) {
            $phone = PhoneHelper::normalize($request->phone);
            if (Customer::where('tenant_id', $tenantId)->where('phone', $phone)->where('id', '!=', $id)->exists()) {
                return ApiResponse::error('Telefone já cadastrado', 'DUPLICATE_PHONE', 409);
            }
            $request->merge(['phone' => $phone]);
        }

        $oldPoints = $customer->points_balance;
        
        $customer->fill($request->all());
        $customer->last_activity_at = now();
        $customer->save();

        if ($request->has('points_balance')) {
            $newPoints = (int)$request->points_balance;
            $diff = $newPoints - $oldPoints;
            
            if ($diff !== 0) {
                \App\Models\PointMovement::create([
                    'tenant_id' => $tenantId,
                    'customer_id' => $customer->id,
                    'type' => $diff > 0 ? 'earn' : 'redeem',
                    'points' => $diff,
                    'origin' => 'crm_manual',
                    'description' => 'Ajuste manual via CRM'
                ]);
            }
        }

        $customer->load(['devices' => function($q) {
            $q->where('status', 'linked')->where('type', 'premium');
        }]);

        return ApiResponse::ok($customer, 'Contato atualizado com sucesso');
    }

    public function deleteContact(Request $request, $id)
    {
        $tenantId = $request->user()->tenant_id;
        $customer = Customer::where('tenant_id', $tenantId)->findOrFail($id);
        $customer->delete();

        return ApiResponse::ok(null, 'Contato excluído com sucesso');
    }

    public function getLoyaltySettings(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $tenant = \App\Models\Tenant::with('loyaltySettings')->findOrFail($tenantId);

        $loyalty = $tenant->loyaltySettings ?: \App\Models\LoyaltySetting::create(['tenant_id' => $tenantId]);

        return ApiResponse::ok([
            'loyalty_active' => $tenant->loyalty_active,
            'points_goal' => $tenant->points_goal,
            'reward_text' => $tenant->reward_text,
            'vip_points_per_scan' => $loyalty->vip_points_per_scan,
            'regular_points_per_scan' => $loyalty->regular_points_per_scan,
            'signup_bonus_points' => $loyalty->signup_bonus_points,
            'cooldown_seconds' => $loyalty->cooldown_seconds,
        ]);
    }

    public function updateLoyaltySettings(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $tenant = \App\Models\Tenant::findOrFail($tenantId);

        $request->validate([
            'loyalty_active' => 'sometimes|boolean',
            'points_goal' => 'sometimes|integer|min:1',
            'reward_text' => 'sometimes|nullable|string',
            'vip_points_per_scan' => 'sometimes|integer|min:1|max:20',
            'regular_points_per_scan' => 'sometimes|integer|min:1|max:20',
            'signup_bonus_points' => 'sometimes|integer|min:0|max:5',
            'cooldown_seconds' => 'sometimes|integer|min:0|max:3600',
        ]);

        $tenant->update($request->only(['loyalty_active', 'points_goal', 'reward_text']));

        $loyalty = \App\Models\LoyaltySetting::firstOrNew(['tenant_id' => $tenantId]);
        $loyalty->fill($request->only([
            'vip_points_per_scan',
            'regular_points_per_scan',
            'signup_bonus_points',
            'cooldown_seconds'
        ]));
        $loyalty->save();

        return ApiResponse::ok([
            'tenant' => $tenant,
            'loyalty' => $loyalty
        ], 'Configurações de fidelidade atualizadas');
    }

    public function getAccountSettings(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $tenant = \App\Models\Tenant::findOrFail($tenantId);
        $settings = TenantSetting::where('tenant_id', $tenantId)->first();
        
        $customersCount = Customer::where('tenant_id', $tenantId)->count();
        $planLimit = \App\Models\Tenant::PLAN_LIMITS[$tenant->plan] ?? 2000;

        return ApiResponse::ok([
            'tenant' => [
                'name' => $tenant->name,
                'logo_url' => $tenant->logo_url,
                'description' => $tenant->description,
                'plan_expires_at' => $tenant->plan_expires_at ? $tenant->plan_expires_at->format('d/m/Y') : null,
                'plan' => $tenant->plan,
                'slug' => $tenant->slug,
                'customers_count' => $customersCount,
                'plan_limit' => $planLimit,
            ],
            'settings' => [
                'telegram_bot_token' => $settings && $settings->telegram_bot_token ? '********' : null,
                'telegram_chat_id' => $settings ? $settings->telegram_chat_id : null,
                'pin' => $settings ? $settings->pin : null,
            ]
        ]);
    }

    public function updateAccountSettings(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $tenant = \App\Models\Tenant::findOrFail($tenantId);
        
        $request->validate([
            'pin' => 'sometimes|nullable|string|size:4',
            'telegram_bot_token' => 'sometimes|nullable|string',
            'telegram_chat_id' => 'sometimes|nullable|string',
            'description' => 'sometimes|nullable|string|max:500',
            'logo_url' => 'sometimes|nullable|string',
        ]);

        if ($request->has('description')) {
            $tenant->update(['description' => $request->description]);
        }

        if ($request->has('logo_url')) {
            $tenant->update(['logo_url' => $request->logo_url]);
        }

        $settings = TenantSetting::firstOrNew(['tenant_id' => $tenantId]);

        if ($request->has('pin') && !empty($request->pin)) {
            $settings->pin = $request->pin;
            $settings->pin_hash = Hash::make($request->pin);
            $settings->pin_updated_at = now();
        }

        if ($request->has('telegram_bot_token')) {
            // Only update if it's NOT the masked value
            if ($request->telegram_bot_token !== '********') {
                $settings->telegram_bot_token = $request->telegram_bot_token;
            }
        }

        if ($request->has('telegram_chat_id')) {
            $settings->telegram_chat_id = $request->telegram_chat_id;
        }

        $settings->save();

        return ApiResponse::ok(null, 'Configurações de conta atualizadas');
    }

    public function updatePin(Request $request)
    {
        $request->validate([
            'pin' => 'required|string|size:4'
        ]);

        $tenantId = $request->user()->tenant_id;

        TenantSetting::updateOrCreate(
            ['tenant_id' => $tenantId],
            [
                'pin' => $request->pin,
                'pin_hash' => Hash::make($request->pin),
                'pin_updated_at' => now(),
            ]
        );

        return ApiResponse::ok(null, 'PIN atualizado com sucesso');
    }

    public function getDevices(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $type = $request->query('type', 'premium');
        $status = $request->query('status');

        $query = Device::where('tenant_id', $tenantId)->where('type', $type);

        if ($status) {
            $query->where('status', $status);
        }

        $devices = $query->with('customer')->get();
        return ApiResponse::ok($devices);
    }

    public function linkDevice(Request $request)
    {
        $request->validate([
            'uid' => 'required|string',
            'customer_id' => 'required|uuid',
        ]);

        $tenantId = $request->user()->tenant_id;

        // RESOLUTE RULE: Validate customer belongs to tenant. Return 404 to avoid leak.
        $customer = Customer::where('tenant_id', $tenantId)
            ->where('id', $request->customer_id)
            ->first();

        if (!$customer) {
            return ApiResponse::error('Cliente não encontrado', 'CUSTOMER_NOT_FOUND', 404);
        }

        try {
            $uidRaw = preg_replace('/\D/', '', $request->uid);
            
            if (strlen($uidRaw) !== 12) {
                return ApiResponse::error('O número do cartão deve ter exatamente 12 dígitos.', 'INVALID_LENGTH', 422);
            }
            
            // The service already checks device ownership, but we ensure consistency
            $device = $this->deviceService->linkDeviceToCustomer(
                $uidRaw, 
                $customer->id, 
                $tenantId
            );
            
            $customer->update(['is_premium' => true]);

            return ApiResponse::ok($device->load('customer'), 'Dispositivo vinculado com sucesso');
        } catch (Exception $e) {
            return ApiResponse::error($e->getMessage(), 'LINK_ERROR', 422);
        }
    }

    public function unlinkDevice(Request $request)
    {
        $request->validate([
            'uid' => 'required|string',
        ]);

        $tenantId = $request->user()->tenant_id;
        $uidRaw = preg_replace('/\D/', '', $request->uid);

        $device = Device::where('tenant_id', $tenantId)
            ->where('uid', $uidRaw)
            ->where('type', 'premium')
            ->firstOrFail();

        $customerId = $device->linked_customer_id;

        $device->update([
            'linked_customer_id' => null,
            'status' => 'assigned'
        ]);

        // If a customer was linked, check if they still have other linked devices
        if ($customerId) {
            $stillHasLinkedDevices = Device::where('tenant_id', $tenantId)
                ->where('linked_customer_id', $customerId)
                ->where('status', 'linked')
                ->exists();

            if (!$stillHasLinkedDevices) {
                // HARDENING: Ensure we only touch customers of this tenant
                Customer::where('id', $customerId)
                    ->where('tenant_id', $tenantId)
                    ->update(['is_premium' => false]);
            }
        }

        return ApiResponse::ok(null, 'Dispositivo desvinculado com sucesso');
    }

    public function toggleDeviceStatus(Request $request, $uid)
    {
        $tenantId = $request->user()->tenant_id;
        $device = Device::where('tenant_id', $tenantId)->where('uid', $uid)->firstOrFail();

        if ($device->status === 'disabled') {
            // Restore status: if it was linked, go back to linked, otherwise assigned.
            // Simplified: if it has a customer, it's linked.
            $device->status = $device->linked_customer_id ? 'linked' : 'assigned';
            $device->active = true;
        } else {
            $device->status = 'disabled';
            $device->active = false;
        }

        $device->save();

        return ApiResponse::ok($device, 'Status do dispositivo atualizado');
    }

    public function getPremiumBatches(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        
        $batches = DeviceBatch::where('tenant_id', $tenantId)
            ->where('type', 'premium')
            ->orderBy('created_at', 'desc')
            ->withCount([
                'devices as total',
                'devices as assigned' => fn($q) => $q->where('status', 'assigned'),
                'devices as linked' => fn($q) => $q->where('status', 'linked'),
                'devices as disabled' => fn($q) => $q->where('status', 'disabled'),
            ])
            ->get();

        return ApiResponse::ok($batches);
    }

    public function getPremiumBatch(Request $request, $id)
    {
        $tenantId = $request->user()->tenant_id;
        $batch = DeviceBatch::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->withCount([
                'devices as total',
                'devices as assigned' => fn($q) => $q->where('status', 'assigned'),
                'devices as linked' => fn($q) => $q->where('status', 'linked'),
                'devices as disabled' => fn($q) => $q->where('status', 'disabled'),
            ])
            ->firstOrFail();

        return ApiResponse::ok($batch);
    }

    public function getPremiumBatchCards(Request $request, $batchId)
    {
        $tenantId = $request->user()->tenant_id;
        
        // Ensure batch belongs to tenant
        DeviceBatch::where('tenant_id', $tenantId)->where('id', $batchId)->firstOrFail();

        $query = Device::where('batch_id', $batchId)
        ->with('customer:id,name,phone');

    if ($request->has('status')) {
        if ($request->status === 'available') {
            $query->where('status', 'assigned');
        } elseif ($request->status === 'linked') {
            $query->where('status', 'linked');
        }
    }

    $query->orderByRaw("CASE WHEN status = 'assigned' THEN 0 WHEN status = 'linked' THEN 1 ELSE 2 END ASC")
          ->orderBy('uid', 'asc');

    $cards = $query->paginate(20);

        return ApiResponse::ok($cards);
    }

    public function disablePremiumCard(Request $request)
    {
        $request->validate(['uid' => 'required|string']);
        $tenantId = $request->user()->tenant_id;
        $uidRaw = preg_replace('/\D/', '', $request->uid);

        $device = Device::where('tenant_id', $tenantId)
            ->where('uid', $uidRaw)
            ->where('type', 'premium')
            ->firstOrFail();

        $customerId = $device->linked_customer_id;

        $device->update([
            'status' => 'disabled',
            'active' => false,
            'linked_customer_id' => null
        ]);

        return ApiResponse::ok($device, 'Cartão cancelado com sucesso');
    }

    public function getLoyaltyHistory(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $phone = $request->query('phone');
        $type = $request->query('type');
        $from = $request->query('from');
        $to = $request->query('to');

        $query = \App\Models\PointMovement::where('tenant_id', $tenantId)
            ->with('customer:id,name,phone');

        if ($phone) {
            $query->whereHas('customer', function ($q) use ($phone) {
                $q->where('phone', 'like', "%$phone%");
            });
        }

        if ($type) {
            $query->where('type', $type);
        }

        if ($from) {
            $query->where('created_at', '>=', $from);
        }

        if ($to) {
            $query->where('created_at', '<=', $to);
        }

        $history = $query->orderBy('created_at', 'desc')->paginate(20);

        return ApiResponse::ok($history);
    }

    public function getDashboardMetrics(Request $request)
{
    $tenantId = $request->user()->tenant_id;

    $totalCustomers = Customer::where('tenant_id', $tenantId)->count();
    
    $totalPointsGenerated = \App\Models\PointMovement::where('tenant_id', $tenantId)
        ->where('type', 'earn')
        ->sum('points');

    $totalRedemptions = \App\Models\PointMovement::where('tenant_id', $tenantId)
        ->where('type', 'redeem')
        ->count();

    $totalPremiumCustomers = Customer::where('tenant_id', $tenantId)
        ->where('is_premium', true)
        ->count();

    $totalLinkedCards = \App\Models\Device::where('tenant_id', $tenantId)
        ->where('status', 'linked')
        ->count();

    $tenant = $request->user()->tenant;

    return ApiResponse::ok([
        'total_customers' => $totalCustomers,
        'total_points_generated' => (int)$totalPointsGenerated,
        'total_redemptions' => $totalRedemptions,
        'total_premium_customers' => $totalPremiumCustomers,
        'total_linked_cards' => $totalLinkedCards,
        'public_page_visits' => $tenant->public_page_visits ?? 0,
    ]);
}
}
