<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

use App\Traits\BelongsToTenant;

class TenantSetting extends Model
{
    use BelongsToTenant;

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
        'telegram_sound_registration',
        'telegram_sound_points',
        'telegram_sound_reminders',
        'logo_url',
        'description',
    ];

    protected $casts = [
        'pin_updated_at' => 'datetime',
        'telegram_sound_registration' => 'boolean',
        'telegram_sound_points' => 'boolean',
        'telegram_sound_reminders' => 'boolean',
    ];

}
