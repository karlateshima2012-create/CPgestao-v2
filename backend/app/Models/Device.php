<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Traits\BelongsToTenant;

class Device extends Model
{
    use HasUuids, BelongsToTenant;

    protected $fillable = [
        'tenant_id',
        'name',
        'nfc_uid',
        'mode',
        'auto_approve',
        'active',
        'telegram_chat_id',
        'responsible_name',
    ];

    protected $casts = [
        'auto_approve' => 'boolean',
        'active' => 'boolean',
    ];

    /**
     * Relationship to the Tenant.
     */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
