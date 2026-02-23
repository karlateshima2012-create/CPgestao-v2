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
        'Start' => 2000,
        'Pro' => 4000,
        'Business' => 8000,
        'Elite' => 999999,
    ];

    protected $fillable = [
        'name',
        'owner_name',
        'phone',
        'email',
        'slug',
        'plan',
        'plan_expires_at',
        'status',
        'renewal_date',
        'loyalty_active',
        'points_goal',
        'reward_text',
        'logo_url',
        'description',
    ];
    
    protected $casts = [
        'plan_expires_at' => 'date',
        'loyalty_active' => 'boolean',
    ];

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
