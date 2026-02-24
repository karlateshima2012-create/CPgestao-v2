<?php

namespace Database\Factories;

use App\Models\Device;
use App\Models\Tenant;
use Illuminate\Database\Eloquent\Factories\Factory;

class DeviceFactory extends Factory
{
    protected $model = Device::class;

    public function definition(): array
    {
        return [
            'tenant_id' => Tenant::factory(),
            'name' => 'Totem Test',
            'nfc_uid' => $this->faker->unique()->bothify('??##??##??##'),
            'mode' => 'approval',
            'active' => true,
            'telegram_chat_id' => $this->faker->numerify('#########'),
        ];
    }
}
