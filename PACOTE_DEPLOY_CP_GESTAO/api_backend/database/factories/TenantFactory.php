<?php

namespace Database\Factories;

use App\Models\Tenant;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class TenantFactory extends Factory
{
    protected $model = Tenant::class;

    public function definition(): array
    {
        return [
            'name' => $this->faker->company(),
            'slug' => $this->faker->slug(),
            'email' => $this->faker->unique()->safeEmail(),
            'plan' => 'Pro',
            'status' => 'active',
            'points_goal' => 10,
            'reward_text' => 'Um café grátis',
            'loyalty_active' => true,
        ];
    }
}
