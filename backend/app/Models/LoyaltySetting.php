<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

use App\Traits\BelongsToTenant;

class LoyaltySetting extends Model
{
    use BelongsToTenant;

    protected $primaryKey = 'tenant_id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'tenant_id',
        'points_goal',
        'redeem_bonus_points',
        'vip_initial_points',
        'vip_points_per_scan',
        'regular_points_per_scan',
        'signup_bonus_points',
        'cooldown_seconds',
        'levels_config',
    ];

    protected $casts = [
        'levels_config' => 'array',
    ];
}
