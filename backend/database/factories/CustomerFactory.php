<?php

namespace Database\Factories;

use App\Models\Customer;
use App\Models\Tenant;
use Illuminate\Database\Eloquent\Factories\Factory;

class CustomerFactory extends Factory
{
    protected $model = Customer::class;

    public function definition(): array
    {
        return [
            'tenant_id' => Tenant::factory(),
            'name' => $this->faker->name(),
            'phone' => '090' . $this->faker->numerify('########'),
            'email' => $this->faker->unique()->safeEmail(),
            'points_balance' => 0,
            'loyalty_level' => 0,
            'is_premium' => false,
            'source' => 'test',
        ];
    }
}
