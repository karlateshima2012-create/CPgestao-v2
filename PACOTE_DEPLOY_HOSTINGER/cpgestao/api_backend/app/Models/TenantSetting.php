<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TenantSetting extends Model
{
    protected $primaryKey = 'tenant_id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'tenant_id',
        'pin',
        'pin_hash',
        'pin_updated_at',
        'telegram_bot_token',
        'telegram_chat_id',
        'logo_url',
        'description',
    ];

    protected $casts = [
        'pin_updated_at' => 'datetime',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }
}
