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
        'device_id',
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

    protected $appends = ['foto_perfil_full', 'customer_photo_url'];

    public function getFotoPerfilFullAttribute()
    {
        return $this->getCustomerPhotoUrlAttribute();
    }

    public function getCustomerPhotoUrlAttribute()
    {
        if ($this->foto_perfil_url) {
            return asset('storage/' . $this->foto_perfil_url);
        }

        // Tenta pegar a foto atual do cliente se o registro da visita não tiver foto
        if ($this->customer) {
            return $this->customer->photo_url_full;
        }

        $parts = explode(' ', trim($this->customer_name ?: 'Cliente'));
        $initials = '';
        if (count($parts) > 0) {
            $initials .= mb_substr($parts[0], 0, 1);
            if (count($parts) > 1) {
                $initials .= mb_substr($parts[count($parts) - 1], 0, 1);
            }
        }
        $initials = mb_strtoupper($initials ?: 'C');
        
        return "https://ui-avatars.com/api/?name=" . urlencode($initials) . "&size=512&background=9ca3af&color=fff&rounded=true&bold=true&format=png";
    }

    /**
     * Relationship to Customer.
     */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    /**
     * Relationship to Device.
     */
    public function device(): BelongsTo
    {
        return $this->belongsTo(Device::class, 'device_id');
    }

    /**
     * Relationship to Approved By (User).
     */
    public function approvedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
