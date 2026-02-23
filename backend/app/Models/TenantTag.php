<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use App\Traits\BelongsToTenant;

class TenantTag extends Model
{
    use HasUuids, BelongsToTenant;

    protected $fillable = ['tenant_id', 'name', 'color', 'category'];
}
