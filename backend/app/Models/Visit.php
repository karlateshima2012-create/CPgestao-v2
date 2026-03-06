<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Visit extends Model
{
    use HasUuids, BelongsToTenant;

    protected $fillable = [
        'tenant_id',
        'customer_id',
        'customer_name',
        'customer_phone',
        'customer_company',
        'customer_photo_url',
        'visit_at',
        'origin',
        'plan_type',
        'status',
        'points_granted',
        'approved_by',
        'approved_at',
        'meta',
    ];

    protected $casts = [
        'visit_at' => 'datetime',
        'approved_at' => 'datetime',
        'points_granted' => 'integer',
        'meta' => 'array',
    ];

    /**
     * Relationship to Customer.
     */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    /**
     * Relationship to Approved By (User).
     */
    public function approvedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
