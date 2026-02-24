<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

use App\Traits\BelongsToTenant;

use Illuminate\Database\Eloquent\Factories\HasFactory;

class Customer extends Model
{
    use HasUuids, BelongsToTenant, HasFactory;

    protected $fillable = [
        'tenant_id',
        'name',
        'phone',
        'email',
        'province',
        'city',
        'postal_code',
        'address',
        'is_premium',
        'source',
        'points_balance',
        'loyalty_level',
        'notes',
        'last_contacted',
        'reminder_date',
        'reminder_time',
        'reminder_text',
        'last_activity_at',
        'birthday',
        'tags',
        'preferences',
        'total_spent',
        'average_ticket',
        'attendance_count',
    ];

    protected $casts = [
        'is_premium' => 'boolean',
        'birthday' => 'date',
        'tags' => 'array',
        'preferences' => 'array',
        'total_spent' => 'decimal:2',
        'average_ticket' => 'decimal:2',
    ];

    protected $appends = ['loyalty_level_name'];

    public function getLoyaltyLevelNameAttribute()
    {
        $cacheKey = "tenant_{$this->tenant_id}_loyalty_levels";
        $levels = cache()->remember($cacheKey, 60 * 24, function () {
            $settings = \App\Models\LoyaltySetting::where('tenant_id', $this->tenant_id)->first();
            return $settings && !empty($settings->levels_config) ? $settings->levels_config : [
                ['name' => 'Bronze', 'active' => true],
                ['name' => 'Prata', 'active' => true],
                ['name' => 'Ouro', 'active' => true],
                ['name' => 'Diamante', 'active' => true],
            ];
        });

        $levelIndex = $this->loyalty_level - 1;
        if (isset($levels[$levelIndex])) {
            $name = $levels[$levelIndex]['name'] ?? 'Nível ' . $this->loyalty_level;
            $emojis = ['🥉', '🥈', '🥇', '💎'];
            $emoji = $emojis[$levelIndex] ?? '💎';
            return "{$emoji} {$name}";
        }

        return 'Nível ' . $this->loyalty_level;
    }


    public function devices(): HasMany
    {
        return $this->hasMany(LoyaltyCard::class, 'linked_customer_id');
    }

    public function movements(): HasMany
    {
        return $this->hasMany(PointMovement::class);
    }

    public function serviceRecords(): HasMany
    {
        return $this->hasMany(ServiceRecord::class);
    }
}
