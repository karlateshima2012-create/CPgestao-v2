<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LoyaltySetting extends Model
{
    protected $primaryKey = 'tenant_id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'tenant_id',
        'points_goal',
        'redeem_bonus_points',
        'vip_points_per_scan',
        'regular_points_per_scan',
        'signup_bonus_points',
        'cooldown_seconds',
    ];
}
