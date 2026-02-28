<?php

namespace App\Scopes;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

class TenantScope implements Scope
{
    /**
     * Apply the scope to a given Eloquent query builder.
     */
    public function apply(Builder $builder, Model $model)
    {
        // Don't apply tenant filtering for public and VIP NFC routes
        if (request()->is('api/public/*') || request()->is('api/vip/*')) {
            return;
        }

        if (auth()->check()) {
            $user = auth()->user();
            
            // Bypass filtering for Super Admins
            if (!$user || $user->role === 'admin') {
                return;
            }

            $builder->where($model->getTable() . '.tenant_id', $user->tenant_id);
        }
    }
}
