<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Traits\BelongsToTenant;

class PointRequest extends Model
{
    use HasUuids, BelongsToTenant;

    protected $fillable = [
        'tenant_id',
        'customer_id',
        'phone',
        'device_id',
        'source',
        'status',
        'requested_points',
        'approved_by',
        'approved_at',
        'meta',
    ];

    protected $casts = [
        'approved_at' => 'datetime',
        'requested_points' => 'integer',
        'meta' => 'array',
    ];

    /**
     * Relationship to the Tenant (Store).
     */
    public function store(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    /**
     * Relationship to the Customer (Client).
     */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    /**
     * Relationship to the User who approved the request.
     */
    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    /**
     * Relationship to the Device that triggered the request.
     */
    public function device(): BelongsTo
    {
        return $this->belongsTo(Device::class, 'device_id');
    }
}
