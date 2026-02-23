<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Device;
use App\Models\PointMovement;
use App\Models\Tenant;
use App\Models\TenantSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Exception;

use App\Http\Responses\ApiResponse;
use App\Utils\PhoneHelper;
use App\Utils\Luhn;
use App\Services\TelegramService;
use Carbon\Carbon;

class PublicTerminalController extends Controller
{
    protected $telegramService;

    public function __construct(TelegramService $telegramService)
    {
        $this->telegramService = $telegramService;
    }
    /**
     * Centralized device validation.
     * RESOLUTE RULE: Returns 404 if anything is wrong to avoid info leaking.
     */
    private function validateDevice($slug, $uid = null)
    {
        $tenant = Tenant::where('slug', $slug)->first();
        if (!$tenant) {
            abort(404);
        }

        if ($tenant->status !== 'active') {
            $msg = $tenant->status === 'blocked' 
                ? 'Esta página está temporariamente indisponível.' 
                : 'Esta loja está temporariamente inativa.';
            abort(403, $msg);
        }

        if ($tenant->plan_expires_at && \Carbon\Carbon::parse($tenant->plan_expires_at)->isPast()) {
            abort(403, 'Não é possível se conectar a esta página no momento');
        }

        if (request()->isMethod('GET')) {
            $tenant->increment('public_page_visits');
        }

        if (!$uid || $uid === 'null') {
            return [$tenant, null];
        }

        $device = Device::where('uid', $uid)
            ->where('tenant_id', $tenant->id)
            ->first();

        if (!$device) {
            abort(404);
        }

        if (!$device->active || $device->status === 'disabled') {
            abort(403, 'Device inativo');
        }

        return [$tenant, $device];
    }

    public function getStoreInfo($slug)
    {
        [$tenant] = $this->validateDevice($slug);
        $loyalty = $tenant->loyaltySettings ?: \App\Models\LoyaltySetting::create(['tenant_id' => $tenant->id]);

        return ApiResponse::ok([
            'tenant' => [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'slug' => $tenant->slug,
                'description' => $tenant->description,
                'logo_url' => $tenant->logo_url,
                'reward_text' => $tenant->reward_text,
                'points_goal' => $tenant->points_goal,
            ],
            'device_type' => 'public_link',
            'prefill_phone' => null,
            'vip_unlinked' => false,
            'message' => null
        ]);
    }

    public function getInfo($slug, $uid)
    {
        [$tenant, $device] = $this->validateDevice($slug, $uid);

        $prefillPhone = null;
        // RESOLUTE RULE: Only prefill if PREMIUM and LINKED.
        if ($device && $device->type === 'premium' && $device->linked_customer_id) {
            $customer = Customer::where('id', $device->linked_customer_id)
                ->where('tenant_id', $tenant->id)
                ->first();
            $prefillPhone = $customer ? $customer->phone : null;
        }

        $loyalty = $tenant->loyaltySettings ?: \App\Models\LoyaltySetting::create(['tenant_id' => $tenant->id]);

        return ApiResponse::ok([
            'tenant' => [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'slug' => $tenant->slug,
                'description' => $tenant->description,
                'logo_url' => $tenant->logo_url,
                'reward_text' => $tenant->reward_text,
                'points_goal' => $tenant->points_goal,
            ],
            'device_type' => $device ? $device->type : 'public_link',
            'prefill_phone' => $prefillPhone,
            'vip_unlinked' => ($device && $device->type === 'premium' && !$device->linked_customer_id),
            'message' => ($device && $device->type === 'premium' && !$device->linked_customer_id) ? 'Cartão não vinculado. Procure o balcão.' : null
        ]);
    }

    public function lookup(Request $request, $slug, $uid = null)
    {
        $request->validate(['phone' => 'required|string']);
        [$tenant, $device] = $this->validateDevice($slug, $uid);
        
        $phone = PhoneHelper::normalize($request->phone);
        
        $customer = Customer::where('tenant_id', $tenant->id)
            ->where('phone', $phone)
            ->first();

        $goal = $tenant->points_goal;
        $balance = $customer ? $customer->points_balance : 0;

        if ($customer) {
            $customer->update(['last_activity_at' => now()]);
        }

        return ApiResponse::ok([
            'customer_exists' => (bool)$customer,
            'customer_name' => $customer ? $customer->name : null,
            'points_balance' => $balance,
            'goal_points' => $goal,
            'remaining' => max($goal - $balance, 0),
            'loyalty_level' => $customer ? $customer->loyalty_level : 1,
            'ready_to_redeem' => $balance >= $goal,
            'is_premium' => $customer ? $customer->is_premium : false
        ]);
    }

    public function validatePin(Request $request, $slug, $uid)
    {
        $request->validate(['pin' => 'required|string']);
        \Illuminate\Support\Facades\Log::info("PIN Validation Start: Slug: $slug, UID: $uid, PIN: {$request->pin}");
        
        try {
            [$tenant, $device] = $this->validateDevice($slug, $uid);
            \Illuminate\Support\Facades\Log::info("Device Validated: Tenant ID: {$tenant->id}");
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error("Device Validation Failed: " . $e->getMessage());
            abort(404);
        }
        
        $settings = TenantSetting::where('tenant_id', $tenant->id)->first();

        if (!$settings) {
            \Illuminate\Support\Facades\Log::warning("Settings not found for tenant: {$tenant->id}");
            return ApiResponse::error('PIN inválido (config não encontrada)', 'INVALID_PIN', 401);
        }

        if (!Hash::check($request->pin, $settings->pin_hash)) {
            \Illuminate\Support\Facades\Log::warning("PIN Mismatch for tenant: {$tenant->id}");
            return ApiResponse::error('PIN inválido', 'INVALID_PIN', 401);
        }

        return ApiResponse::ok(null, 'PIN válido');
    }

    public function earn(Request $request, $slug, $uid)
    {
        $request->validate([
            'phone' => 'required|string',
            'pin' => 'required|string'
        ]);

        return DB::transaction(function () use ($request, $slug, $uid) {
            [$tenant, $device] = $this->validateDevice($slug, $uid);
            
            // Validate PIN
            $settings = TenantSetting::where('tenant_id', $tenant->id)->first();
            if (!$settings || !Hash::check($request->pin, $settings->pin_hash)) {
                $deviceId = $device ? $device->uid : 'public_link';
                \Illuminate\Support\Facades\Log::warning("PIN inválido no terminal: Tenant {$tenant->id}, Device {$deviceId}, IP {$request->ip()}");
                return ApiResponse::error('PIN inválido', 'INVALID_PIN', 401);
            }

            $phone = PhoneHelper::normalize($request->phone);

            $customer = Customer::where('tenant_id', $tenant->id)
                ->where('phone', $phone)
                ->first();

            $isNew = false;
            if (!$customer) {
                $isNew = true;
                $customer = Customer::create([
                    'tenant_id' => $tenant->id,
                    'phone' => $phone,
                    'name' => 'Cliente',
                    'source' => 'terminal',
                    'last_activity_at' => now()
                ]);

                $this->telegramService->sendMessage($tenant->id, "🆕 <b>Novo Cliente (Pontuação Balcão)</b>\n\n<b>Telefone:</b> {$customer->phone}");
            }

            $loyalty = $tenant->loyaltySettings ?: \App\Models\LoyaltySetting::create(['tenant_id' => $tenant->id]);

            // ANTI-FRAUDE: Cooldown padrão do sistema (60s)
            $cooldown = 60;
            $lastMovement = PointMovement::where('customer_id', $customer->id)
                ->where('tenant_id', $tenant->id)
                ->where('type', 'earn')
                ->where('created_at', '>', now()->subSeconds($cooldown))
                ->first();

            if ($lastMovement) {
                return ApiResponse::error('Aguarde um momento para pontuar novamente', 'COOLDOWN', 429);
            }

            // Grant signup bonus if new
            if ($isNew && $loyalty->signup_bonus_points > 0) {
                $bonus = $loyalty->signup_bonus_points;
                $customer->increment('points_balance', $bonus);
                PointMovement::create([
                    'tenant_id' => $tenant->id,
                    'customer_id' => $customer->id,
                    'type' => 'earn',
                    'points' => $bonus,
                    'origin' => 'signup_bonus',
                    'description' => 'Bônus de primeiro cadastro'
                ]);
            }

            $pointsToAdd = $customer->is_premium 
                ? ($loyalty->vip_points_per_scan ?? 2) 
                : ($loyalty->regular_points_per_scan ?? 1); 

            $customer->increment('points_balance', $pointsToAdd);
            $customer->update(['last_activity_at' => now()]);

            PointMovement::create([
                'tenant_id' => $tenant->id,
                'customer_id' => $customer->id,
                'type' => 'earn',
                'points' => $pointsToAdd,
                'origin' => $device ? $device->type : 'public_link',
                'device_id' => $device ? $device->id : null,
                'meta' => json_encode([
                    'ip' => $request->ip(),
                    'ua' => $request->userAgent(),
                ])
            ]);

            $newBalance = $customer->fresh()->points_balance;
            $goal = $tenant->points_goal;
            $msg = "✅ +{$pointsToAdd} ponto(s) adicionado(s). Saldo: {$newBalance} / Meta: {$goal}.";
            
            if ($newBalance >= $goal) {
                $msg .= " 🎉 Meta atingida! Pronto para resgatar.";
            }

            return ApiResponse::ok([
                'points_earned' => $pointsToAdd, 
                'new_balance' => $newBalance,
                'message' => $msg
            ]);
        });
    }

    public function redeem(Request $request, $slug, $uid)
    {
        $request->validate([
            'phone' => 'required|string',
            'pin' => 'required|string'
        ]);

        return DB::transaction(function () use ($request, $slug, $uid) {
            [$tenant, $device] = $this->validateDevice($slug, $uid);
            
            // Validate PIN
            $settings = TenantSetting::where('tenant_id', $tenant->id)->first();
            if (!$settings || !Hash::check($request->pin, $settings->pin_hash)) {
                $deviceId = $device ? $device->uid : 'public_link';
                \Illuminate\Support\Facades\Log::warning("PIN inválido no terminal (redeem): Tenant {$tenant->id}, Device {$deviceId}, IP {$request->ip()}");
                return ApiResponse::error('PIN inválido', 'INVALID_PIN', 401);
            }

            $phone = PhoneHelper::normalize($request->phone);
            $customer = Customer::where('tenant_id', $tenant->id)->where('phone', $phone)->first();

            $loyalty = $tenant->loyaltySettings ?: \App\Models\LoyaltySetting::create(['tenant_id' => $tenant->id]);
            $goal = $tenant->points_goal;

            if (!$customer || $customer->points_balance < $goal) {
                return ApiResponse::error('Saldo insuficiente para resgate', 'INSUFFICIENT_POINTS', 409);
            }

            $pointsToAdd = $customer->is_premium 
                ? ($loyalty->vip_points_per_scan ?? 2) 
                : ($loyalty->regular_points_per_scan ?? 1);

            $prevBalance = $customer->points_balance;
            $bonus = $loyalty->redeem_bonus_points ?? 0;
            $vipInitial = $loyalty->vip_initial_points ?? 0;
            
            // Lógica VIP: Se não era premium, agora vira.
            $wasPremium = $customer->is_premium;
            if (!$wasPremium) {
                $customer->is_premium = true;
            }

            // Lógica "Próxima Visita": O cliente resgata e já ganha os pontos da visita atual + bônus de resgate + pontos iniciais de VIP (se estiver subindo de nível ou se estiver configurado)
            // Se ele já era VIP, não aplicamos os pontos iniciais de novo? 
            // O usuário disse: "Sobe de nivel -> Recebe cartão vip -> Reinicia a contagem com o ponto inicial de vip"
            // Vou aplicar o vipInitial apenas na primeira vez que ele vira VIP? 
            // Geralmente esses "pontos iniciais" são para o novo ciclo.
            
            $appliedVipInitial = (!$wasPremium) ? $vipInitial : 0;
            
            $customer->points_balance = ($customer->points_balance - $goal) + $pointsToAdd + $bonus + $appliedVipInitial;
            $customer->loyalty_level += 1;
            $customer->last_activity_at = now();
            $customer->save();

            // Log do Resgate
            PointMovement::create([
                'tenant_id' => $tenant->id,
                'customer_id' => $customer->id,
                'type' => 'redeem',
                'points' => -$goal,
                'origin' => $device ? $device->type : 'public_link',
                'device_id' => $device ? $device->id : null,
                'description' => 'Resgate de prêmio',
                'meta' => json_encode([
                    'prev_balance' => $prevBalance,
                    'goal' => $goal,
                    'new_level' => $customer->loyalty_level,
                    'ip' => $request->ip(),
                ])
            ]);

            // Log dos pontos da visita de resgate
            PointMovement::create([
                'tenant_id' => $tenant->id,
                'customer_id' => $customer->id,
                'type' => 'earn',
                'points' => $pointsToAdd,
                'origin' => $device ? $device->type : 'public_link',
                'device_id' => $device ? $device->id : null,
                'description' => 'Pontos da visita (Resgate)',
                'meta' => json_encode([
                    'bonus_applied' => $bonus,
                    'ip' => $request->ip(),
                ])
            ]);

            return ApiResponse::ok([
                'new_level' => $customer->loyalty_level,
                'new_balance' => $customer->points_balance,
                'message' => "🏆 Prêmio resgatado! Nível {$customer->loyalty_level}. Saldo reiniciado com +{$bonus}."
            ]);
        });
    }

    public function register(Request $request, $slug, $uid = null)
    {
        $request->validate([
            'name' => 'required|string|max:100',
            'phone' => 'required|string',
            'email' => 'nullable|email|max:100',
            'city' => 'required|string|max:100',
            'province' => 'nullable|string|max:100',
        ]);

        return DB::transaction(function () use ($request, $slug, $uid) {
            [$tenant, $device] = $this->validateDevice($slug, $uid);

            $phone = PhoneHelper::normalize($request->phone);

            // Check for existing
            if (Customer::where('tenant_id', $tenant->id)->where('phone', $phone)->exists()) {
                return ApiResponse::error('Este número de telefone já está cadastrado nesta loja. Para visualizar os pontos, utilize a opção Consultar saldo.', 'DUPLICATE_PHONE', 409);
            }

            $customer = Customer::create([
                'tenant_id' => $tenant->id,
                'name' => $request->name,
                'phone' => $phone,
                'email' => $request->email,
                'city' => $request->city,
                'province' => $request->province,
                'source' => 'terminal',
                'last_activity_at' => now()
            ]);

            $this->telegramService->sendMessage($tenant->id, "✨ <b>Novo Cliente Cadastrado (Totem)</b>\n\n<b>Nome:</b> {$customer->name}\n<b>Telefone:</b> {$customer->phone}");

            $loyalty = $tenant->loyaltySettings ?: \App\Models\LoyaltySetting::create(['tenant_id' => $tenant->id]);
            
            $bonusMessage = "";
            if ($loyalty->signup_bonus_points > 0) {
                $bonus = $loyalty->signup_bonus_points;
                $customer->increment('points_balance', $bonus);
                PointMovement::create([
                    'tenant_id' => $tenant->id,
                    'customer_id' => $customer->id,
                    'type' => 'earn',
                    'points' => $bonus,
                    'origin' => 'signup_bonus',
                    'description' => 'Bônus de boas-vindas'
                ]);
                $bonusMessage = " +{$bonus} ponto(s) de bônus adicionado(s)!";
            }

            return ApiResponse::ok([
                'customer_exists' => true,
                'points_balance' => $customer->points_balance,
                'is_premium' => false
            ], "✅ Cadastro realizado com sucesso!{$bonusMessage}");
        });
    }


    public function linkVip(Request $request, $slug, $uid)
    {
        $request->validate([
            'phone' => 'required|string',
            'target_uid' => 'required|string',
            'pin' => 'required|string'
        ]);

        return DB::transaction(function () use ($request, $slug, $uid) {
            [$tenant, $device] = $this->validateDevice($slug, $uid);
            
            // Validate PIN
            $settings = TenantSetting::where('tenant_id', $tenant->id)->first();
            if (!$settings || !Hash::check($request->pin, $settings->pin_hash)) {
                return ApiResponse::error('PIN inválido', 'INVALID_PIN', 401);
            }

            $phone = PhoneHelper::normalize($request->phone);
            $customer = Customer::where('tenant_id', $tenant->id)->where('phone', $phone)->firstOrFail();

            if ($customer->is_premium) {
                return ApiResponse::error('Este cliente já possui um cartão VIP vinculado.', 'ALREADY_PREMIUM', 400);
            }

            $targetUidRaw = preg_replace('/\D/', '', $request->target_uid);
            
            if (strlen($targetUidRaw) !== 12) {
                return ApiResponse::error('O número do cartão deve ter exatamente 12 dígitos.', 'INVALID_LENGTH', 400);
            }
            
            // Resolve target device
            $targetDevice = Device::where('tenant_id', $tenant->id)
                ->where('uid', $targetUidRaw)
                ->where('type', 'premium')
                ->first();

            if (!$targetDevice) {
                return ApiResponse::error('Cartão VIP não encontrado ou inválido.', 'VIP_NOT_FOUND', 404);
            }

            if ($targetDevice->linked_customer_id) {
                return ApiResponse::error('Este cartão já está vinculado a outro cliente.', 'ALREADY_LINKED', 409);
            }

            $targetDevice->update([
                'linked_customer_id' => $customer->id,
                'status' => 'linked',
                'active' => true
            ]);

            $customer->update(['is_premium' => true]);

            return ApiResponse::ok(null, 'Cartão VIP vinculado com sucesso');
        });
    }
}
