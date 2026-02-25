<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\Tenant;
use App\Models\Customer;
use App\Models\Device;
use App\Models\PointRequest;
use App\Services\TelegramService;
use App\Events\PointRequestStatusUpdated;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Mockery;

class TelegramWebhookTest extends TestCase
{
    use RefreshDatabase;

    protected $telegramServiceMock;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Mock TelegramService
        $this->telegramServiceMock = Mockery::mock(TelegramService::class);
        $this->app->instance(TelegramService::class, $this->telegramServiceMock);
    }

    public function test_it_approves_point_request_via_telegram_webhook()
    {
        // Fake events
        Event::fake();

        // Setup
        $tenant = Tenant::factory()->create();
        $customer = Customer::factory()->create([
            'tenant_id' => $tenant->id,
            'points_balance' => 10,
        ]);
        
        // Device is needed for the chat_id validation in controller
        $device = Device::factory()->create([
            'tenant_id' => $tenant->id,
            'telegram_chat_id' => '999888777'
        ]);

        $request = PointRequest::create([
            'tenant_id' => $tenant->id,
            'customer_id' => $customer->id,
            'phone' => $customer->phone,
            'requested_points' => 3,
            'status' => 'pending',
            // 'device_id' => $device->id, // Skipping due to SQLite FK mismatch after table rename migrations
            'source' => 'approval',
        ]);

        // Mock Telegram Expectations
        $this->telegramServiceMock->shouldReceive('answerCallbackQuery')
            ->once();
        
        $this->telegramServiceMock->shouldReceive('editMessage')
            ->once()
            ->with('999888777', '12345', Mockery::on(function ($text) {
                return strpos($text, 'APROVADA') !== false;
            }));

        // Execute Webhook call
        $response = $this->postJson('/api/webhooks/telegram', [
            'callback_query' => [
                'id' => 'callback_id_1',
                'data' => "approve_request:{$request->id}",
                'message' => [
                    'chat' => ['id' => '999888777'],
                    'message_id' => '12345',
                    'text' => 'Solicitação de 3 pontos para Cliente'
                ]
            ]
        ]);

        // Verify
        $response->assertStatus(200);
        $response->assertJson(['status' => 'success']);

        $customer->refresh();
        $this->assertEquals(13, $customer->points_balance);
        
        $request->refresh();
        $this->assertEquals('approved', $request->status);
        $this->assertNotNull($request->approved_at);

        $this->assertDatabaseHas('point_movements', [
            'tenant_id' => $tenant->id,
            'customer_id' => $customer->id,
            'points' => 3,
            'type' => 'earn',
        ]);

        // Verify WebSocket Event
        Event::assertDispatched(PointRequestStatusUpdated::class, function ($event) use ($request) {
            return $event->request->id === $request->id;
        });
    }
}
