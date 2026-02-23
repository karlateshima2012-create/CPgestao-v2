<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Tenant extends Model
{
    use HasUuids;
    
    public const PLAN_LIMITS = [
        'Pro' => 8000,
        'Elite' => 999999,
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
    ];

    protected $casts = [
        'plan_expires_at' => 'date',
        'loyalty_active' => 'boolean',
        'custom_contact_limit' => 'integer',
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
}
