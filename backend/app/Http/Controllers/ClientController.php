<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Device;
use App\Models\DeviceBatch;
use App\Models\CustomerReminder;
use App\Models\TenantSetting;
use App\Services\DeviceService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Exception;
use App\Models\PointMovement;
use App\Models\LoyaltySetting;
use App\Http\Responses\ApiResponse;
use App\Utils\PhoneHelper;
use App\Services\TelegramService;
use Illuminate\Support\Facades\DB;

class ClientController extends Controller
{
    protected $deviceService;
    protected $telegramService;
    protected $photoService;

    public function __construct(
        DeviceService $deviceService, 
        TelegramService $telegramService,
        \App\Services\CustomerPhotoService $photoService
    ) {
        $this->deviceService = $deviceService;
        $this->telegramService = $telegramService;
        $this->photoService = $photoService;
    }

    public function getContacts(Request $request)
    {
        $query = Customer::query();

        if ($request->has('search')) {
            $s = $request->search;
            $raw = preg_replace('/\D/', '', $s);
            $normalized = PhoneHelper::normalize($s);
            $noZero = str_starts_with($normalized, '0') ? substr($normalized, 1) : $normalized;
            $with81 = '81' . $noZero;
            
            $query->where(function($q) use ($s, $raw, $normalized, $with81) {
                $q->where('name', 'like', "%$s%")
                  ->orWhere('phone', 'like', "%$s%")
                  ->orWhere('phone', 'like', "%$raw%")
                  ->orWhere('phone', 'like', "%$normalized%")
                  ->orWhere('phone', 'like', "%$with81%");
            });
        }

        $contacts = $query->orderBy('created_at', 'desc')
            ->limit(100)
            ->get();
            
        return ApiResponse::ok($contacts);
    }

    public function getContact(Request $request, $id)
    {
        $customer = Customer::findOrFail($id);
            
        return ApiResponse::ok($customer);
    }

    public function storeContact(Request $request)
    {
        $request->validate([
            'name' => 'required|string',
            'phone' => 'required|string',
            'company_name' => 'sometimes|string|nullable',
            'city' => 'sometimes|string|nullable',
            'province' => 'sometimes|string|nullable',
            'postal_code' => 'sometimes|string|nullable',
            'address' => 'sometimes|string|nullable',
            'points_balance' => 'sometimes|integer',
            'photo' => 'sometimes|nullable|string', // Base64 expected from frontend or null
        ]);

        $phone = PhoneHelper::normalize($request->phone);
        if (Customer::where('phone', $phone)->exists()) {
            return ApiResponse::error('Este número de telefone já está cadastrado nesta loja.', 'DUPLICATE_PHONE', 409);
        }

        $loyalty = \App\Models\LoyaltySetting::where('tenant_id', auth()->user()->tenant_id)->first();
        
        $signupBonus = 0;
        if ($loyalty) {
            $levels = $loyalty->levels_config;
            if ($levels && count($levels) > 0 && isset($levels[0]['points_per_signup'])) {
                $signupBonus = (int)$levels[0]['points_per_signup'];
            } else {
                $signupBonus = (int)$loyalty->signup_bonus_points;
            }
        }
        $initialPoints = (int)($request->points_balance ?? 0);

        if ($request->user()->tenant->isLimitReached()) {
            return ApiResponse::error('Você atingiu o limite de contatos do seu plano. Realize o upgrade para continuar cadastrando.', 'PLAN_LIMIT_REACHED', 403);
        }

        try {
            return DB::transaction(function() use ($request, $phone, $initialPoints, $signupBonus) {
                $customer = Customer::create([
                    'name' => $request->name,
                    'phone' => $phone,
                    'company_name' => $request->company_name,
                    'email' => $request->email,
                    'city' => $request->city,
                    'province' => $request->province,
                    'postal_code' => $request->postal_code,
                    'address' => $request->address,
                    'points_balance' => $initialPoints + $signupBonus,
                    'source' => $request->source ?? 'crm',
                    'last_activity_at' => now(),
                    'notes' => $request->notes,
                    'last_contacted' => $request->last_contacted,
                    'reminder_date' => $request->reminder_date,
                    'reminder_text' => $request->reminder_text,
                    'birthday' => $request->birthday,
                    'tags' => $request->tags ?? [],
                    'preferences' => $request->preferences ?? [],
                    'attendance_count' => 0,
                ]);

                if ($request->photo) {
                    $path = $this->photoService->processAndSave($request->photo, $customer->id);
                    $customer->update(['foto_perfil_url' => $path]);
                }

                $request->user()->tenant->verifyAndNotifyLimit();

                if ($initialPoints > 0) {
                    try {
                        \App\Models\PointMovement::create([
                            'tenant_id' => $customer->tenant_id,
                            'customer_id' => $customer->id,
                            'type' => 'earn',
                            'points' => $initialPoints,
                            'origin' => 'crm_manual',
                            'description' => 'Saldo inicial via CRM'
                        ]);
                    } catch (\Exception $e) {
                        \Illuminate\Support\Facades\Log::warning("PointMovement Initial Balance Fallback: " . $e->getMessage());

                    }
                }

                if ($signupBonus > 0) {
                    \App\Models\PointMovement::create([
                        'tenant_id' => $customer->tenant_id,
                        'customer_id' => $customer->id,
                        'type' => 'earn',
                        'points' => $signupBonus,
                        'origin' => 'crm_bonus',
                        'description' => 'Bônus de Cadastro'
                    ]);
                }

                $escName = TelegramService::escapeMarkdownV2($customer->name);
                $escPhone = TelegramService::escapeMarkdownV2($customer->phone);
                \App\Jobs\SendTelegramNotificationJob::dispatch(
                    $customer->tenant_id, 
                    "👤 *Novo Cliente Cadastrado \(CRM\)*\n\n*Nome:* {$escName}\n*Telefone:* {$escPhone}"
                );

                return ApiResponse::ok($customer, "Contato criado com sucesso");
            });
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Store Contact Error: ' . $e->getMessage(), [

                'trace' => $e->getTraceAsString()
            ]);
            return ApiResponse::error('Erro ao cadastrar contato: ' . $e->getMessage(), 'STORE_CONTACT_ERROR', 500);
        }
    }

    public function updateContact(Request $request, $id)
    {
        $customer = Customer::findOrFail($id);

        $request->validate([
            'name' => 'sometimes|string',
            'phone' => 'sometimes|string',
            'company_name' => 'sometimes|string|nullable',
            'city' => 'sometimes|string|nullable',
            'province' => 'sometimes|string|nullable',
            'postal_code' => 'sometimes|string|nullable',
            'address' => 'sometimes|string|nullable',
            'email' => 'sometimes|email|nullable',
            'points_balance' => 'sometimes|integer',
            'source' => 'sometimes|string',
            'birthday' => 'sometimes|date|nullable',
            'tags' => 'sometimes|array|nullable',
            'preferences' => 'sometimes|array|nullable',
            'photo' => 'sometimes|string|nullable',
        ]);

        if ($request->has('phone')) {
            $phone = PhoneHelper::normalize($request->phone);
            if (Customer::where('phone', $phone)->where('id', '!=', $id)->exists()) {
                return ApiResponse::error('Telefone já cadastrado', 'DUPLICATE_PHONE', 409);
            }
            $customer->phone = $phone;
        }

        if ($request->has('photo')) {
            if ($request->photo) {
                $this->photoService->delete($customer->foto_perfil_url);
                $path = $this->photoService->processAndSave($request->photo, $customer->id);
                $customer->foto_perfil_url = $path;
            } else {
                // Remove photo if explicitly null
                $this->photoService->delete($customer->foto_perfil_url);
                $customer->foto_perfil_url = null;
            }
        }

        $oldPoints = $customer->points_balance;
        
        $data = $request->except(['phone', 'photo', 'foto_perfil_url']);
        $customer->fill($data);
        $customer->last_activity_at = now();
        $customer->save();

        if ($request->has('points_balance')) {
            $newPoints = (int)$request->points_balance;
            $diff = $newPoints - $oldPoints;
            
            if ($diff !== 0) {
                try {
                    \App\Models\PointMovement::create([
                        'tenant_id' => $customer->tenant_id,
                        'customer_id' => $customer->id,
                        'type' => $diff > 0 ? 'earn' : 'redeem',
                        'points' => abs($diff),
                        'origin' => 'crm_manual',
                        'description' => 'Ajuste manual via CRM'
                    ]);
                } catch (\Exception $e) {
                    \Illuminate\Support\Facades\Log::warning("PointMovement CRM Adjustment Fallback: " . $e->getMessage());

                    // Minimal fallback for PointMovement
                    \App\Models\PointMovement::create([
                        'customer_id' => $customer->id,
                        'type' => $diff > 0 ? 'earn' : 'redeem',
                        'points' => abs($diff),
                    ]);
                }
            }
        }

        $customer->load(['reminders' => function($q) {
            $q->orderBy('reminder_date', 'desc')->orderBy('reminder_time', 'desc')->limit(3);
        }]);

        return ApiResponse::ok($customer, 'Contato atualizado com sucesso');
    }

    /**
     * Manually award a prize (Premiar) and move customer to the next level.
     */
    public function redeemReward(Request $request, $id)
    {
        $tenantId = auth()->user()->tenant_id;
        $customer = Customer::where('tenant_id', $tenantId)->findOrFail($id);
        
        $loyalty = LoyaltySetting::where('tenant_id', $tenantId)->first();
        if (!$loyalty) return ApiResponse::error('Fidelidade não configurada', 'LOYALTY_NOT_FOUND', 404);
        
        $levelsConfig = $loyalty->levels_config;
        $currentLevel = (int)($customer->loyalty_level ?? 1);
        
        $goal = $request->user()->tenant->points_goal;
        $lvlIdx = max(0, $currentLevel - 1);
        if (is_array($levelsConfig) && isset($levelsConfig[$lvlIdx])) {
            $goal = (int)($levelsConfig[$lvlIdx]['goal'] ?? $goal);
        }
        
        if ($customer->points_balance < $goal) {
            $levelName = $levelsConfig[$lvlIdx]['name'] ?? 'atual';
            return ApiResponse::error("Saldo insuficiente ({$customer->points_balance}/{$goal}) para resgate no nível {$levelName}", 'INSUFFICIENT_POINTS', 400);
        }

        return DB::transaction(function () use ($customer, $loyalty, $goal, $currentLevel, $levelsConfig) {
            $nextLevelIdx = $currentLevel; 
            $pointsToAdd = (int)($loyalty->regular_points_per_scan ?? 1);
            
            if (is_array($levelsConfig) && isset($levelsConfig[$nextLevelIdx]) && isset($levelsConfig[$nextLevelIdx]['points_per_visit'])) {
                $pointsToAdd = (int) $levelsConfig[$nextLevelIdx]['points_per_visit'];
            }

            // Create a mock request for applyPoints
            $mockRequest = (object)[
                'tenant_id' => $customer->tenant_id,
                'customer_id' => $customer->id,
                'requested_points' => $pointsToAdd,
                'id' => 'redeem_manual_' . uniqid(),
                'source' => 'crm_manual',
                'meta' => [
                    'is_redemption' => true,
                    'goal' => $goal
                ]
            ];

            $service = new \App\Services\PointRequestService();
            $service->applyPoints($mockRequest);

            return ApiResponse::ok($customer->fresh(), "Premiação realizada com sucesso! O cliente avançou para o próximo nível.");
        });
    }


    public function getContactReminders(Request $request, $id)
    {
        try {
            $customer = Customer::findOrFail($id);
            $reminders = $customer->reminders()
                ->orderBy('reminder_date', 'desc')
                ->orderBy('reminder_time', 'desc')
                ->limit(3)
                ->get();
                
            return ApiResponse::ok($reminders);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Get Reminders Error: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
            return ApiResponse::error('Erro ao buscar lembretes: ' . $e->getMessage(), 'REMINDERS_ERROR', 500);
        }
    }

    public function storeContactReminder(Request $request, $id)
    {
        try {
            $customer = Customer::findOrFail($id);
            
            $activeCount = $customer->reminders()
                ->where('status', 'pending')
                ->where('reminder_date', '>=', now()->toDateString())
                ->count();
                
            if ($activeCount >= 3) {
                return ApiResponse::error('Este cliente já possui 3 lembretes pendentes. Aguarde o envio ou exclua algum.', 'LIMIT_REACHED', 422);
            }

            $request->validate([
                'reminder_date' => 'required|date',
                'reminder_time' => 'required|string',
                'reminder_text' => 'required|string|max:200',
            ]);

            $reminder = $customer->reminders()->create([
                'tenant_id' => $customer->tenant_id,
                'reminder_date' => $request->reminder_date,
                'reminder_time' => $request->reminder_time,
                'reminder_text' => $request->reminder_text,
                'status' => 'pending'
            ]);

            return ApiResponse::ok($reminder, 'Lembrete agendado com sucesso');
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Store Reminder Error: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
            return ApiResponse::error('Erro ao salvar lembrete: ' . $e->getMessage(), 'REMINDERS_ERROR', 500);
        }
    }

    public function deleteReminder(Request $request, $id)
    {
        $reminder = \App\Models\CustomerReminder::where('tenant_id', $request->user()->tenant_id)->findOrFail($id);
        $reminder->delete();
        
        return ApiResponse::ok(null, 'Lembrete excluído');
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
        $settings = \App\Models\TenantSetting::where('tenant_id', $tenant->id)->first();
        
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
                'plan_limit' => $tenant->total_contact_limit,
                'extra_contacts_quota' => $tenant->extra_contacts_quota,
            ],
            'settings' => [
                'telegram_chat_id' => $settings ? $settings->telegram_chat_id : null,
                'telegram_sound_registration' => $settings ? (bool)$settings->telegram_sound_registration : true,
                'telegram_sound_points' => $settings ? (bool)$settings->telegram_sound_points : true,
                'telegram_sound_reminders' => $settings ? (bool)$settings->telegram_sound_reminders : true,
                'pin' => $settings ? $settings->pin : null,
            ]
        ]);
    }

    public function updateAccountSettings(Request $request)
    {
        $tenant = $request->user()->tenant;
        
        $request->validate([
            'pin' => 'sometimes|nullable|string|size:4',
            'telegram_chat_id' => 'sometimes|nullable|string',
            'telegram_sound_registration' => 'sometimes|boolean',
            'telegram_sound_points' => 'sometimes|boolean',
            'telegram_sound_reminders' => 'sometimes|boolean',
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

            // Update or Create TenantSettings
            $settings = TenantSetting::updateOrCreate(
                ['tenant_id' => $tenant->id],
                [
                    'telegram_chat_id' => $request->telegram_chat_id,
                    'telegram_sound_registration' => $request->boolean('telegram_sound_registration', true),
                    'telegram_sound_points' => $request->boolean('telegram_sound_points', true),
                    'telegram_sound_reminders' => $request->boolean('telegram_sound_reminders', true),
                ]
            );

            if ($request->has('pin') && !empty($request->pin)) {
                $settings->pin = $request->pin;
                $settings->pin_hash = Hash::make($request->pin);
                $settings->pin_updated_at = now();
            }

            // Ensure a default PIN exists if this is a new record or PIN is missing
            if (!$settings->pin_hash) {
                $settings->pin = '1234';
                $settings->pin_hash = Hash::make('1234');
                $settings->pin_updated_at = now();
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
        $status = $request->query('status');

        $query = Device::query();
        if ($status) {
            $query->where('active', $status === 'active');
        }
        return ApiResponse::ok($query->get());
    }

    public function storeDevice(Request $request)
    {
        $tenant = $request->user()->tenant;
        
        $planService = app(\App\Services\PlanService::class);
        $planService->validateDeviceLimit($tenant);

        $request->validate([
            'name' => 'required|string',
            'mode' => 'required|string|in:manual,approval,auto_checkin',
            'telegram_chat_id' => 'nullable|string',
            'responsible_name' => 'nullable|string',
        ]);

        $device = \App\Models\Device::create([
            'tenant_id' => $tenant->id,
            'name' => $request->name,
            'nfc_uid' => \Illuminate\Support\Str::random(12),
            'mode' => $request->mode,
            'telegram_chat_id' => $request->telegram_chat_id,
            'responsible_name' => $request->responsible_name ?: $request->name,
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
            'nfc_uid' => 'sometimes|string|unique:devices,nfc_uid,' . $deviceId,
        ]);

        $data = $request->only(['name', 'mode', 'telegram_chat_id', 'responsible_name', 'nfc_uid']);
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

    public function toggleDeviceStatus(Request $request, $uid)
    {
        $device = \App\Models\Device::where('nfc_uid', $uid)

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
        try {
            $tenantId = $request->user()->tenant_id;
            $tenant = $request->user()->tenant;
            
            // Básicos
            $totalCustomers = Customer::count();
            $activeCustomers30d = Customer::where('last_activity_at', '>=', now()->subDays(30))->count();
            $newCustomers30d = Customer::where('created_at', '>=', now()->subDays(30))->count();
            $prevNewCustomers30d = Customer::where('created_at', '>=', now()->subDays(60))
                                           ->where('created_at', '<', now()->subDays(30))
                                           ->count();
            
            $customerGrowth = 0;
            if ($prevNewCustomers30d > 0) {
                $customerGrowth = (($newCustomers30d - $prevNewCustomers30d) / $prevNewCustomers30d) * 100;
            } elseif ($newCustomers30d > 0) {
                $customerGrowth = 100;
            }

            $pointsInCirculation = (int)Customer::sum('points_balance');
            $totalRevenue = (float)Customer::sum('total_spent');
            
            $totalPointsEarned = (int)PointMovement::where('type', 'earn')->sum('points');
            $totalRedemptions = PointMovement::where('type', 'redeem')->count();
            
            // Taxa de Resgate
            $redemptionRate = 0;
            if ($totalPointsEarned > 0) {
                $pointsRedeemed = (int)PointMovement::where('type', 'redeem')->sum('points');
                $pointsRedeemedAbs = abs($pointsRedeemed);
                $redemptionRate = ($pointsRedeemedAbs / $totalPointsEarned) * 100;
            }

            // Sugestões
            $loyalty = LoyaltySetting::where('tenant_id', $tenantId)->first();
            $pointsGoal = $loyalty ? $loyalty->points_goal : 10;
            
            // Accurate Met Goal check based on first level goal (usually the main one)
            $firstLvlGoal = (is_array($loyalty->levels_config) && isset($loyalty->levels_config[0])) 
                ? (int)($loyalty->levels_config[0]['goal'] ?? $pointsGoal)
                : $pointsGoal;

            $metGoalCount = Customer::where('points_balance', '>=', $firstLvlGoal)->count();

            $nearRewardCount = Customer::where('points_balance', '>=', $firstLvlGoal * 0.8)
                                       ->where('points_balance', '<', $firstLvlGoal)
                                       ->count();
                                       
            $inactive30d = Customer::where('last_activity_at', '<=', now()->subDays(30))
                                   ->count();

            $suggestions = [];
            
            if ($metGoalCount > 0) {
                $suggestions[] = [
                    'type' => 'success',
                    'title' => '🏆 Premiação Disponível',
                    'text' => "{$metGoalCount} clientes atingiram a meta e aguardam premiação",
                    'color' => 'emerald'
                ];
            }

            if ($nearRewardCount > 0) {
                $suggestions[] = [
                    'type' => 'opportunity',
                    'title' => 'Oportunidade de Resgate',
                    'text' => "{$nearRewardCount} clientes estão perto de resgatar prêmio",
                    'color' => 'orange'
                ];
            }
            if ($inactive30d > 0) {
                $suggestions[] = [
                    'type' => 'warning',
                    'title' => 'Risco de Churn',
                    'text' => "{$inactive30d} clientes estão inativos há mais de 30 dias",
                    'color' => 'red'
                ];
            }
            if ($redemptionRate < 15 && $totalPointsEarned > 100) {
                $suggestions[] = [
                    'type' => 'info',
                    'title' => 'Otimização de Fidelidade',
                    'text' => "Sua taxa de resgate está baixa (" . round($redemptionRate, 1) . "%)",
                    'color' => 'blue'
                ];
            }

            return ApiResponse::ok([
                'total_customers' => $totalCustomers,
                'active_customers' => $activeCustomers30d,
                'new_customers_30d' => $newCustomers30d,
                'customer_growth_30d' => round($customerGrowth, 1),
                'points_in_circulation' => $pointsInCirculation,
                'total_redemptions' => $totalRedemptions,
                'total_revenue' => $totalRevenue,
                'public_page_visits' => $tenant->public_page_visits ?? 0,
                'redemption_rate' => round($redemptionRate, 1),
                'suggestions' => $suggestions,
                'total_points_generated' => $totalPointsEarned,
                'total_visitas' => Customer::sum('attendance_count'),
                'active_reminders' => CustomerReminder::with('customer:id,name,phone')
                    ->where('status', 'pending')
                    ->where('reminder_date', '>=', now()->toDateString())
                    ->where('reminder_date', '<=', now()->addDays(7)->toDateString())
                    ->orderBy('reminder_date', 'asc')
                    ->orderBy('reminder_time', 'asc')
                    ->paginate(6, ['*'], 'reminders_page'),
                'met_goal_count' => $metGoalCount,
            ]);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Dashboard Metrics Error: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
            return ApiResponse::error('Erro ao carregar métricas: ' . $e->getMessage());
        }
    }

    /**
     * Process a base64 image: Crop to square (centralized), resize to 400x400,
     * convert to WEBP and compress.
     */
    private function processAndStorePhoto(string $base64Image): string
    {
        try {
            // Strip out header if present (data:image/png;base64,...)
            if (preg_match('/^data:image\/(\w+);base64,/', $base64Image, $type)) {
                $base64Image = substr($base64Image, strpos($base64Image, ',') + 1);
                $type = strtolower($type[1]); // png, jpg, etc.
            } else {
                throw new \Exception('Invalid image format');
            }

            $imgData = base64_decode($base64Image);
            if (!$imgData) throw new \Exception('Base64 decode failed');

            $sourceImage = imagecreatefromstring($imgData);
            if (!$sourceImage) throw new \Exception('Failed to create image from string');

            $width = imagesx($sourceImage);
            $height = imagesy($sourceImage);

            // 1. Crop to square (centralized)
            $size = min($width, $height);
            $x = ($width - $size) / 2;
            $y = ($height - $size) / 2;

            $squareImage = imagecreatetruecolor(400, 400);
            
            // Preserve transparency for PNGs before conversion to webp
            imagealphablending($squareImage, false);
            imagesavealpha($squareImage, true);
            
            imagecopyresampled($squareImage, $sourceImage, 0, 0, $x, $y, 400, 400, $size, $size);

            // 2. Generate filename
            $filename = 'customers/' . uniqid() . '.webp';
            
            // 3. Save as WEBP with compression
            ob_start();
            imagewebp($squareImage, null, 80); // 80 quality (approx 80-120KB)
            $webpData = ob_get_clean();

            \Illuminate\Support\Facades\Storage::disk('public')->put($filename, $webpData);

            imagedestroy($sourceImage);
            imagedestroy($squareImage);

            return $filename;
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Photo processing failed: ' . $e->getMessage());

            return '';
        }
    }
}
