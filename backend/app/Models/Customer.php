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
        'foto_perfil_url',
        'phone',
        'company_name',
        'email',
        'province',
        'city',
        'postal_code',
        'address',
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

    /**
     * ALWAYS normalize phone number on save to ensure consistency.
     */
    public function setPhoneAttribute($value)
    {
        // Absolute normalization for storage (Steel-reinforced)
        $normalized = preg_replace('/\D/', '', (string)$value);
        if (str_starts_with($normalized, '81') && strlen($normalized) >= 11) {
             $normalized = substr($normalized, 2);
        }
        $normalized = ltrim($normalized, '0');
        if (!empty($normalized)) {
            $normalized = '0' . $normalized;
        }
        $this->attributes['phone'] = $normalized;
    }



    protected $casts = [
        'birthday' => 'date:Y-m-d',
        'tags' => 'array',
        'preferences' => 'array',
        'total_spent' => 'decimal:2',
        'average_ticket' => 'decimal:2',
    ];

    protected $appends = ['loyalty_level_name', 'photo_url_full', 'foto_perfil_thumb_url'];

    public function getFotoPerfilThumbUrlAttribute()
    {
        if ($this->foto_perfil_url) {
            $thumbPath = str_replace('clientes/', 'clientes/thumbs/', $this->foto_perfil_url);
            return $this->generateStorageUrl($thumbPath);
        }
        return $this->getPhotoUrlFullAttribute();
    }

    public function getPhotoUrlFullAttribute()
    {
        if ($this->foto_perfil_url) {
            return $this->generateStorageUrl($this->foto_perfil_url);
        }

        $nameDisplay = (string)($this->name ?? 'Cliente');
        $parts = explode(' ', trim($nameDisplay));
        $initials = '';
        if (count($parts) > 0 && !empty($parts[0])) {
            $initials .= mb_substr($parts[0], 0, 1);
            if (count($parts) > 1 && !empty($parts[count($parts) - 1])) {
                $initials .= mb_substr($parts[count($parts) - 1], 0, 1);
            }
        }
        $initials = mb_strtoupper($initials ?: 'C');
        
        return "https://ui-avatars.com/api/?name=" . urlencode($initials) . "&size=512&background=9ca3af&color=fff&rounded=true&bold=true&format=png";
    }

    private function generateStorageUrl($path)
    {
        $appUrl = config('app.url');
        
        // Se o APP_URL estiver como localhost ou vazio, tentamos detectar o host real
        if (($appUrl === 'http://localhost' || empty($appUrl)) && isset($_SERVER['HTTP_HOST'])) {
            $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
            $appUrl = "{$protocol}://{$_SERVER['HTTP_HOST']}";
        }
        
        // Garantimos que o caminho comece com /storage/
        return rtrim($appUrl, '/') . '/storage/' . $path;
    }

    public function getLoyaltyLevelNameAttribute()
    {
        $cacheKey = "tenant_{$this->tenant_id}_loyalty_levels";
        $levels = cache()->remember($cacheKey, 60 * 24, function () {
            $settings = \App\Models\LoyaltySetting::withoutGlobalScopes()->where('tenant_id', $this->tenant_id)->first();
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


    public function movements(): HasMany
    {
        return $this->hasMany(PointMovement::class);
    }

    public function serviceRecords(): HasMany
    {
        return $this->hasMany(ServiceRecord::class);
    }

    public function reminders(): HasMany
    {
        return $this->hasMany(CustomerReminder::class);
    }
}
