<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Customer extends Model
{
    use HasUuids;

    protected $fillable = [
        'tenant_id',
        'name',
        'phone',
        'email',
        'province',
        'city',
        'is_premium',
        'source',
        'points_balance',
        'loyalty_level',
        'notes',
        'last_contacted',
        'reminder_date',
        'reminder_text',
        'last_activity_at',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function devices(): HasMany
    {
        return $this->hasMany(Device::class, 'linked_customer_id');
    }

    public function movements(): HasMany
    {
        return $this->hasMany(PointMovement::class);
    }
}
