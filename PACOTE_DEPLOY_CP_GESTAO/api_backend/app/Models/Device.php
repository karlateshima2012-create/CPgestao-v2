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
        'batch_id',
        'type',
        'uid',
        'active',
        'status',
        'linked_customer_id',
    ];

    protected $appends = ['uid_formatted'];

    public function getUidFormattedAttribute(): string
    {
        if (mb_strlen($this->uid) === 16) {
            return preg_replace('/(\d{4})(\d{4})(\d{4})(\d{4})/', '$1 $2 $3 $4', $this->uid);
        }
        if (mb_strlen($this->uid) === 12) {
            return preg_replace('/(\d{4})(\d{4})(\d{4})/', '$1 $2 $3', $this->uid);
        }
        return $this->uid;
    }


    public function batch(): BelongsTo
    {
        return $this->belongsTo(DeviceBatch::class, 'batch_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'linked_customer_id');
    }
}
