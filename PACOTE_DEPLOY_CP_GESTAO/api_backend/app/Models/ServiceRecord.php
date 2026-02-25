<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use App\Traits\BelongsToTenant;

class ServiceRecord extends Model
{
    use HasUuids, BelongsToTenant;

    protected $fillable = [
        'tenant_id',
        'customer_id',
        'service_name',
        'amount',
        'payment_method',
        'notes',
        'service_date',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'service_date' => 'datetime',
    ];

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }
}
