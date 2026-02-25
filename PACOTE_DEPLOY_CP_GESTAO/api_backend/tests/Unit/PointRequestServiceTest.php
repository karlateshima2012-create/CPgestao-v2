<?php

namespace Tests\Unit;

use Tests\TestCase;
use App\Models\Customer;
use App\Models\PointRequest;
use App\Models\Tenant;
use App\Services\PointRequestService;
use App\Models\PointMovement;
use Illuminate\Foundation\Testing\RefreshDatabase;

class PointRequestServiceTest extends TestCase
{
    use RefreshDatabase;

    protected $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new PointRequestService();
    }

    public function test_it_applies_points_correctly_to_customer()
    {
        // Setup
        $tenant = Tenant::factory()->create();
        $customer = Customer::factory()->create([
            'tenant_id' => $tenant->id,
            'points_balance' => 10,
        ]);

        $request = PointRequest::create([
            'tenant_id' => $tenant->id,
            'customer_id' => $customer->id,
            'phone' => $customer->phone,
            'requested_points' => 5,
            'status' => 'pending',
            'source' => 'approval',
        ]);

        // Execute
        $this->service->applyPoints($request);

        // Verify
        $customer->refresh();
        $this->assertEquals(15, $customer->points_balance);
        
        $this->assertDatabaseHas('point_movements', [
            'tenant_id' => $tenant->id,
            'customer_id' => $customer->id,
            'points' => 5,
            'type' => 'earn',
        ]);
    }

    public function test_it_handles_redemption_correctly()
    {
        // Setup
        $tenant = Tenant::factory()->create();
        $customer = Customer::factory()->create([
            'tenant_id' => $tenant->id,
            'points_balance' => 20,
            'loyalty_level' => 0,
            'is_premium' => false,
        ]);

        $request = PointRequest::create([
            'tenant_id' => $tenant->id,
            'customer_id' => $customer->id,
            'phone' => $customer->phone,
            'requested_points' => 2, // Points earned in the same visit
            'status' => 'pending',
            'source' => 'approval',
            'meta' => [
                'is_redemption' => true,
                'goal' => 15,
                'bonus' => 0,
                'vip_initial' => 5,
            ]
        ]);

        // Execute
        $this->service->applyPoints($request);

        // Verify
        $customer->refresh();
        // points_balance = (20 - 15) + 2 (requested) + 5 (vip_initial) = 12
        $this->assertEquals(12, $customer->points_balance);
        $this->assertTrue($customer->is_premium);
        $this->assertEquals(1, $customer->loyalty_level);

        $this->assertDatabaseHas('point_movements', [
            'type' => 'redeem',
            'points' => -15,
        ]);

        $this->assertDatabaseHas('point_movements', [
            'type' => 'earn',
            'points' => 2,
        ]);
    }
}
