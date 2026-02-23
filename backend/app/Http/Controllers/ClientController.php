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
        $contacts = Customer::with(['devices' => function($q) {
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
            'city' => 'sometimes|string|nullable',
            'province' => 'sometimes|string|nullable',
            'postal_code' => 'sometimes|string|nullable',
            'address' => 'sometimes|string|nullable',
            'points_balance' => 'sometimes|integer',
            'is_premium' => 'sometimes|boolean',
        ]);

        $phone = PhoneHelper::normalize($request->phone);
        if (Customer::where('phone', $phone)->exists()) {
            return ApiResponse::error('Este número de telefone já está cadastrado nesta loja.', 'DUPLICATE_PHONE', 409);
        }

        $customer = Customer::create([
            'name' => $request->name,
            'phone' => $phone,
            'email' => $request->email,
            'city' => $request->city,
            'province' => $request->province,
            'postal_code' => $request->postal_code,
            'address' => $request->address,
            'is_premium' => $request->is_premium ?? false,
            'points_balance' => $request->points_balance ?? 0,
            'source' => $request->source ?? 'crm',
            'last_activity_at' => now(),
            'notes' => $request->notes,
            'last_contacted' => $request->last_contacted,
            'reminder_date' => $request->reminder_date,
            'reminder_text' => $request->reminder_text,
            'birthday' => $request->birthday,
            'tags' => $request->tags ?? [],
            'preferences' => $request->preferences ?? [],
        ]);

        if ($customer->points_balance > 0) {
            \App\Models\PointMovement::create([
                'customer_id' => $customer->id,
                'type' => 'earn',
                'points' => $customer->points_balance,
                'origin' => 'crm_manual',
                'description' => 'Saldo inicial via CRM'
            ]);
        }

        $this->telegramService->sendMessage($customer->tenant_id, "👤 <b>Novo Cliente Cadastrado (CRM)</b>\n\n<b>Nome:</b> {$customer->name}\n<b>Telefone:</b> {$customer->phone}");

        $customer->load(['devices' => function($q) {
            $q->where('status', 'linked')->where('type', 'premium');
        }]);

        return ApiResponse::ok($customer, 'Contato criado com sucesso');
    }

    public function updateContact(Request $request, $id)
    {
        $customer = Customer::findOrFail($id);

        $request->validate([
            'name' => 'sometimes|string',
            'phone' => 'sometimes|string',
            'city' => 'sometimes|string|nullable',
            'province' => 'sometimes|string|nullable',
            'postal_code' => 'sometimes|string|nullable',
            'address' => 'sometimes|string|nullable',
            'email' => 'sometimes|email|nullable',
            'is_premium' => 'sometimes|boolean',
            'points_balance' => 'sometimes|integer',
            'source' => 'sometimes|string',
            'birthday' => 'sometimes|date|nullable',
            'tags' => 'sometimes|array|nullable',
            'preferences' => 'sometimes|array|nullable',
        ]);

        if ($request->has('phone')) {
            $phone = PhoneHelper::normalize($request->phone);
            if (Customer::where('phone', $phone)->where('id', '!=', $id)->exists()) {
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
        $customer = Customer::findOrFail($id);
        $customer->delete();

        return ApiResponse::ok(null, 'Contato excluído com sucesso');
    }

    public function getLoyaltySettings(Request $request)
    {
        $tenant = $request->user()->tenant;

        $loyalty = $tenant->loyaltySettings ?: \App\Models\LoyaltySetting::create([]);

        return ApiResponse::ok([
            'loyalty_active' => $tenant->loyalty_active,
            'points_goal' => $tenant->points_goal,
            'reward_text' => $tenant->reward_text,
            'description' => $tenant->description,
            'rules_text' => $tenant->rules_text,
            'vip_points_per_scan' => $loyalty->vip_points_per_scan,
            'regular_points_per_scan' => $loyalty->regular_points_per_scan,
            'signup_bonus_points' => $loyalty->signup_bonus_points,
            'vip_initial_points' => $loyalty->vip_initial_points,
            'cooldown_seconds' => $loyalty->cooldown_seconds,
            'levels_config' => $loyalty->levels_config,
        ]);
    }

    public function updateLoyaltySettings(Request $request)
    {
        $tenant = $request->user()->tenant;

        $request->validate([
            'loyalty_active' => 'sometimes|boolean',
            'points_goal' => 'sometimes|integer|min:1',
            'reward_text' => 'sometimes|nullable|string',
            'description' => 'sometimes|nullable|string',
            'rules_text' => 'sometimes|nullable|string',
            'vip_points_per_scan' => 'sometimes|integer|min:1|max:20',
            'regular_points_per_scan' => 'sometimes|integer|min:1|max:20',
            'signup_bonus_points' => 'sometimes|integer|min:0|max:10',
            'vip_initial_points' => 'sometimes|integer|min:0|max:10',
            'cooldown_seconds' => 'sometimes|integer|min:0|max:3600',
            'levels_config' => 'sometimes|nullable|array',
        ]);

        $tenant->update($request->only(['loyalty_active', 'points_goal', 'reward_text', 'description', 'rules_text']));

        $loyalty = \App\Models\LoyaltySetting::firstOrNew([]);
        $loyalty->fill($request->only([
            'vip_points_per_scan',
            'regular_points_per_scan',
            'signup_bonus_points',
            'vip_initial_points',
            'cooldown_seconds',
            'levels_config'
        ]));
        $loyalty->save();

        cache()->forget("tenant_{$tenant->id}_loyalty_levels");

        return ApiResponse::ok([
            'tenant' => $tenant,
            'loyalty' => $loyalty
        ], 'Configurações de fidelidade atualizadas');
    }

    public function getAccountSettings(Request $request)
    {
        $tenant = $request->user()->tenant;
        $settings = TenantSetting::first();
        
        $customersCount = Customer::count();
        $planLimit = \App\Models\Tenant::PLAN_LIMITS[$tenant->plan] ?? 2000;

        return ApiResponse::ok([
            'tenant' => [
                'name' => $tenant->name,
                'logo_url' => $tenant->logo_url,
                'cover_url' => $tenant->cover_url,
                'rules_text' => $tenant->rules_text,
                'reward_text' => $tenant->reward_text,
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
                'telegram_sound_registration' => $settings ? (bool)$settings->telegram_sound_registration : true,
                'telegram_sound_points' => $settings ? (bool)$settings->telegram_sound_points : true,
                'pin' => $settings ? $settings->pin : null,
            ]
        ]);
    }

    public function updateAccountSettings(Request $request)
    {
        $tenant = $request->user()->tenant;
        
        $request->validate([
            'pin' => 'sometimes|nullable|string|size:4',
            'telegram_bot_token' => 'sometimes|nullable|string',
            'telegram_chat_id' => 'sometimes|nullable|string',
            'telegram_sound_registration' => 'sometimes|boolean',
            'telegram_sound_points' => 'sometimes|boolean',
            'description' => 'sometimes|nullable|string|max:500',
            'logo_url' => 'sometimes|nullable|string',
            'cover_url' => 'sometimes|nullable|string',
            'rules_text' => 'sometimes|nullable|string',
            'reward_text' => 'sometimes|nullable|string',
        ]);

        try {
            $tenantUpdate = [];
            if ($request->has('description')) {
                $tenantUpdate['description'] = $request->description;
            }
            if ($request->has('logo_url')) {
                $tenantUpdate['logo_url'] = $request->logo_url;
            }
            if ($request->has('cover_url')) {
                $tenantUpdate['cover_url'] = $request->cover_url;
            }
            if ($request->has('rules_text')) {
                $tenantUpdate['rules_text'] = $request->rules_text;
            }
            if ($request->has('reward_text')) {
                $tenantUpdate['reward_text'] = $request->reward_text;
            }
            
            if (!empty($tenantUpdate)) {
                $tenant->update($tenantUpdate);
            }

            // TenantSetting uses tenant_id as PK, so we use find()
            $settings = TenantSetting::first();
            
            if (!$settings) {
                $settings = new TenantSetting();
                $settings->tenant_id = $tenant->id;
            }

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

            if ($request->has('telegram_sound_registration')) {
                $settings->telegram_sound_registration = $request->telegram_sound_registration;
            }

            if ($request->has('telegram_sound_points')) {
                $settings->telegram_sound_points = $request->telegram_sound_points;
            }

            $settings->save();

            return ApiResponse::ok(null, 'Configurações de conta atualizadas');
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Account Settings Update Error', [
                'tenant_id' => $tenant->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return ApiResponse::error('Erro interno ao salvar configurações', 500);
        }
    }

    public function updatePin(Request $request)
    {
        $request->validate([
            'pin' => 'required|string|size:4'
        ]);

        TenantSetting::updateOrCreate(
            ['tenant_id' => $request->user()->tenant_id],
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
        $type = $request->query('type', 'premium');
        $status = $request->query('status');

        $query = Device::where('type', $type);

        if ($type !== 'premium') {
            $query->orWhereNull('type');
        }

        if ($status) {
            $query->where('status', $status);
        }

        $devices = $query->with('customer')->get();
        return ApiResponse::ok($devices);
    }

    public function storeDevice(Request $request)
    {
        $tenant = $request->user()->tenant;
        
        $planService = app(\App\Services\PlanService::class);
        $planService->validateDeviceLimit($tenant);

        $request->validate([
            'name' => 'required|string',
            'mode' => 'required|string|in:manual,approval,auto_checkin',
        ]);

        $device = \App\Models\Device::create([
            'tenant_id' => $tenant->id,
            'name' => $request->name,
            'nfc_uid' => \Illuminate\Support\Str::random(12),
            'mode' => $request->mode,
            'auto_approve' => $request->mode === 'auto_checkin',
            'active' => true,
        ]);

        return ApiResponse::ok($device, 'Terminal registrado com sucesso');
    }

    public function updateDevice(Request $request, $deviceId)
    {
        $device = \App\Models\Device::where('tenant_id', $request->user()->tenant_id)->findOrFail($deviceId);

        $request->validate([
            'name' => 'sometimes|string',
            'mode' => 'sometimes|string|in:manual,approval,auto_checkin',
            'telegram_chat_id' => 'nullable|string',
            'responsible_name' => 'nullable|string',
        ]);

        $data = $request->only(['name', 'mode', 'telegram_chat_id', 'responsible_name']);
        if (isset($data['mode'])) {
            $data['auto_approve'] = $data['mode'] === 'auto_checkin';
        }

        $device->update($data);

        return ApiResponse::ok($device, 'Terminal atualizado com sucesso');
    }

    public function deleteDevice(Request $request, $deviceId)
    {
        $device = \App\Models\Device::where('tenant_id', $request->user()->tenant_id)->findOrFail($deviceId);
        $device->delete();
        return ApiResponse::ok(null, 'Terminal excluído com sucesso');
    }

    public function linkDevice(Request $request)
    {
        $request->validate([
            'uid' => 'required|string',
            'customer_id' => 'required|uuid',
        ]);

        // RESOLUTE RULE: Validate customer belongs to tenant. Return 404 to avoid leak.
        $customer = Customer::where('id', $request->customer_id)
            ->where('tenant_id', $request->user()->tenant_id)
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
                $customer->tenant_id
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

        $uidRaw = preg_replace('/\D/', '', $request->uid);

        $device = Device::where('uid', $uidRaw)
            ->where('type', 'premium')
            ->firstOrFail();

        $customerId = $device->linked_customer_id;

        $device->update([
            'linked_customer_id' => null,
            'status' => 'assigned'
        ]);

        // If a customer was linked, check if they still have other linked devices
        if ($customerId) {
            $stillHasLinkedDevices = Device::where('linked_customer_id', $customerId)
                ->where('status', 'linked')
                ->exists();

            if (!$stillHasLinkedDevices) {
                // HARDENING: Ensure we only touch customers of this tenant
                Customer::where('id', $customerId)
                    ->update(['is_premium' => false]);
            }
        }

        return ApiResponse::ok(null, 'Dispositivo desvinculado com sucesso');
    }

    public function toggleDeviceStatus(Request $request, $uid)
    {
        $device = Device::where('uid', $uid)
            ->firstOrFail();

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
        $batches = DeviceBatch::where('type', 'premium')
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
        $batch = DeviceBatch::where('id', $id)
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
        
        // Ensure batch belongs to tenant
        DeviceBatch::findOrFail($batchId);

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
        $phone = $request->query('phone');
        $type = $request->query('type');
        $from = $request->query('from');
        $to = $request->query('to');

        $query = \App\Models\PointMovement::with('customer:id,name,phone');

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

    $totalCustomers = Customer::count();
    
    $totalPointsGenerated = \App\Models\PointMovement::where('type', 'earn')
        ->sum('points');

    $totalRedemptions = \App\Models\PointMovement::where('type', 'redeem')
        ->count();

    $totalPremiumCustomers = Customer::where('is_premium', true)
        ->count();

    $totalLinkedCards = \App\Models\Device::where('status', 'linked')
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
