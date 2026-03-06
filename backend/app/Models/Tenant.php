<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasMany;

use Illuminate\Database\Eloquent\Factories\HasFactory;

class Tenant extends Model
{
    use HasUuids, HasFactory;

    protected $appends = ['total_contact_limit'];
    
    public const PLAN_LIMITS = [
        'Pro' => 4000,
        'Elite' => 6000,
    ];

    protected $fillable = [
        'name',
        'owner_name',
        'phone',
        'email',
        'slug',
        'plan',
        'plan_id',
        'custom_contact_limit',
        'plan_expires_at',
        'status',
        'renewal_date',
        'loyalty_active',
        'points_goal',
        'reward_text',
        'logo_url',
        'cover_url',
        'rules_text',
        'description',
        'extra_contacts_quota',
    ];

    protected $casts = [
        'plan_expires_at' => 'date',
        'loyalty_active' => 'boolean',
        'custom_contact_limit' => 'integer',
        'extra_contacts_quota' => 'integer',
    ];

    public function planRelationship(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Plan::class, 'plan_id');
    }

    public function getPlanFeature(string $slug, $default = null)
    {
        if ($slug === 'contact_limit' && $this->custom_contact_limit !== null) {
            return $this->custom_contact_limit;
        }

        // Load plan relationship if not already loaded
        if (!$this->relationLoaded('planRelationship')) {
            $this->load('planRelationship.features');
        }

        if ($this->planRelationship) {
            return $this->planRelationship->getFeatureValue($slug, $default);
        }

        // Hardcoded fallbacks based on plan name string (Classic/Pro/Elite)
        // This handles cases where plans were not seeded or linked yet
        $planType = strtolower($this->plan ?? '');
        $defaults = [
            'pro' => [
                'contact_limit' => 4000,
                'device_limit' => 3,
                'allow_auto_approve' => 0,
                'allow_online_qr' => 1,
            ],
            'elite' => [
                'contact_limit' => 6000,
                'device_limit' => 99,
                'allow_auto_approve' => 1,
                'allow_online_qr' => 1,
                'auto_checkin_full' => 1,
            ]
        ];

        if (isset($defaults[$planType][$slug])) {
            return $defaults[$planType][$slug];
        }

        return $default;
    }

    public function settings(): HasOne
    {
        return $this->hasOne(TenantSetting::class, 'tenant_id');
    }

    public function loyaltySettings(): HasOne
    {
        return $this->hasOne(LoyaltySetting::class, 'tenant_id');
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function customers(): HasMany
    {
        return $this->hasMany(Customer::class);
    }

    public function getTotalContactLimitAttribute(): int
    {
        // Special case for Infinity
        if ($this->extra_contacts_quota === -1) {
            return 999999;
        }

        $baseLimit = $this->custom_contact_limit ?? self::PLAN_LIMITS[$this->plan] ?? 2000;
        return $baseLimit + $this->extra_contacts_quota;
    }

    public function isLimitReached(): bool
    {
        return $this->customers()->count() >= $this->total_contact_limit;
    }

    public function getUsagePercentage(): float
    {
        $limit = $this->total_contact_limit;
        if ($limit <= 0) return 0;
        return ($this->customers()->count() / $limit) * 100;
    }

    public function verifyAndNotifyLimit(): void
    {
        $percentage = $this->getUsagePercentage();
        $telegram = app(\App\Services\TelegramService::class);

        if ($percentage >= 100) {
            $telegram->sendMessage($this->id, "🚫 *Limite Atingido\!* O cadastro de novos clientes foi pausado\.");
        } elseif ($percentage >= 80) {
            // Use cache to avoid spamming 80% alerts
            $cacheKey = "tenant_{$this->id}_80_alert_sent";
            if (!cache()->has($cacheKey)) {
                $telegram->sendMessage($this->id, "⚠️ *Atenção\!* Sua base de clientes atingiu 80% da capacidade\. Faça um upgrade agora\!");
                cache()->put($cacheKey, true, now()->addDays(7));
            }
        }
    }
}
