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
        'foto_perfil_url',
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

    protected $appends = ['foto_perfil_full'];

    public function getFotoPerfilFullAttribute()
    {
        if ($this->foto_perfil_url) {
            return asset('storage/' . $this->foto_perfil_url);
        }

        $initials = collect(explode(' ', $this->customer_name))
            ->map(fn($n) => mb_substr($n, 0, 1))
            ->take(2)
            ->join('');
        
        return "https://ui-avatars.com/api/?name=" . urlencode($initials) . "&background=random&color=fff&size=400&rounded=true";
    }

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
