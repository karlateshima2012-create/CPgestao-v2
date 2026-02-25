<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Plan extends Model
{
    use HasUuids;

    protected $fillable = ['name', 'slug', 'description'];

    public function features(): HasMany
    {
        return $this->hasMany(PlanFeature::class);
    }

    public function getFeatureValue(string $slug, $default = null)
    {
        $feature = $this->features()->where('feature_slug', $slug)->first();
        return $feature ? $feature->feature_value : $default;
    }
}
