<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\BusinessHour;
use App\Models\Product;
use App\Models\ProductOption;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Carbon\CarbonImmutable;
use Tests\TestCase;

class OrderLifecycleTest extends TestCase
{
    use RefreshDatabase;

    protected $seed = true;

    public function test_customer_can_create_an_order_with_server_pricing_and_idempotent_retry(): void
    {
        $customer = User::where('email', 'test@example.com')->firstOrFail();
        $product = Product::where('slug', 'margherita-pizza')->firstOrFail();
        $branch = Branch::where('name', 'Casa Forno Center')->firstOrFail();
        $large = ProductOption::where('name', 'Large')->firstOrFail();
        $payload = [
            'branch_id' => $branch->id,
            'schedule_type' => 'asap',
            'expected_total' => 24.00,
            'items' => [['product_id' => $product->id, 'quantity' => 2, 'options' => [$large->id]]],
        ];

        $first = $this->actingAs($customer)->withHeader('Idempotency-Key', 'order-create-0001')->postJson('/api/orders', $payload);
        $first->assertCreated()
            ->assertJsonPath('order.total', '24.00')
            ->assertJsonPath('order.payment_method', 'cash_at_pickup');
        $token = $first->json('pickup_token');
        $this->assertNotEmpty($token);
        $this->assertDatabaseCount('orders', 16);
        $this->assertDatabaseHas('order_items', ['product_name' => 'Margherita Pizza', 'quantity' => 2, 'line_total' => 24]);
        $this->assertDatabaseHas('order_item_options', ['option_name' => 'Large', 'price_delta' => 2.5]);

        $this->withHeader('Idempotency-Key', 'order-create-0001')->postJson('/api/orders', $payload)
            ->assertOk()->assertJsonPath('pickup_token', $token);
        $this->withHeader('Idempotency-Key', 'order-create-0001')->postJson('/api/orders', [
            ...$payload,
            'items' => [['product_id' => $product->id, 'quantity' => 1, 'options' => [$large->id]]],
        ])->assertStatus(409);
        $this->assertDatabaseCount('orders', 16);
    }

    public function test_order_statuses_follow_the_workflow_and_pickup_code_is_single_use(): void
    {
        $customer = User::where('email', 'test@example.com')->firstOrFail();
        $manager = User::where('email', 'manager@foodora.demo')->firstOrFail();
        $branch = Branch::where('name', 'Casa Forno Center')->firstOrFail();
        $product = Product::where('slug', 'margherita-pizza')->firstOrFail();
        $regular = ProductOption::where('name', 'Regular')->firstOrFail();

        $created = $this->actingAs($customer)->withHeader('Idempotency-Key', 'order-flow-0001')->postJson('/api/orders', [
            'branch_id' => $branch->id,
            'schedule_type' => 'asap',
            'items' => [['product_id' => $product->id, 'quantity' => 1, 'options' => [$regular->id]]],
        ])->assertCreated();
        $orderId = $created->json('order.id');
        $token = $created->json('pickup_token');

        $this->actingAs($customer)->patchJson("/api/orders/{$orderId}/status", ['status' => 'confirmed', 'eta_minutes' => 24])->assertForbidden();
        $this->actingAs($manager)->patchJson("/api/orders/{$orderId}/status", ['status' => 'confirmed', 'eta_minutes' => 24])->assertOk()->assertJsonPath('status', 'confirmed');
        $this->patchJson("/api/orders/{$orderId}/status", ['status' => 'preparing'])->assertOk()->assertJsonPath('status', 'preparing');
        $this->patchJson("/api/orders/{$orderId}/status", ['status' => 'ready'])->assertStatus(409);
        $itemId = \App\Models\OrderItem::where('order_id', $orderId)->value('id');
        $this->postJson("/api/orders/{$orderId}/items/{$itemId}/complete")->assertOk();
        $this->postJson("/api/orders/{$orderId}/packaging-confirmed")->assertOk();
        $this->patchJson("/api/orders/{$orderId}/status", ['status' => 'ready'])->assertOk()->assertJsonPath('status', 'ready');
        $this->postJson("/api/orders/{$orderId}/pickup", ['pickup_token' => $token])->assertStatus(409);
        $total = \App\Models\Order::findOrFail($orderId)->total;
        $this->postJson("/api/orders/{$orderId}/payment", ['amount' => 1])->assertUnprocessable();
        $this->postJson("/api/orders/{$orderId}/payment", ['amount' => $total])->assertOk()->assertJsonPath('payment_status', 'paid');
        $this->postJson("/api/orders/{$orderId}/pickup", ['pickup_token' => $token])->assertOk()->assertJsonPath('status', 'picked_up')->assertJsonPath('payment_status', 'paid');
        $this->postJson("/api/orders/{$orderId}/pickup", ['pickup_token' => $token])->assertStatus(409);
        $this->assertSame(5, \App\Models\OrderStatusHistory::where('order_id', $orderId)->count());
        $this->assertDatabaseHas('payments', ['order_id' => $orderId, 'status' => 'paid', 'method' => 'cash_at_pickup']);
    }

    public function test_customer_cannot_order_a_product_from_another_business(): void
    {
        $customer = User::where('email', 'test@example.com')->firstOrFail();
        $branch = Branch::where('name', 'Casa Forno Center')->firstOrFail();
        $foreignProduct = Product::where('slug', 'classic-smash-burger')->firstOrFail();

        $this->actingAs($customer)->withHeader('Idempotency-Key', 'invalid-cross-shop-01')->postJson('/api/orders', [
            'branch_id' => $branch->id,
            'schedule_type' => 'asap',
            'items' => [['product_id' => $foreignProduct->id, 'quantity' => 1]],
        ])->assertUnprocessable();
        $this->assertDatabaseCount('orders', 15);
    }

    public function test_server_requires_confirmation_when_the_current_menu_total_differs(): void
    {
        $customer = User::where('email', 'test@example.com')->firstOrFail();
        $branch = Branch::where('name', 'Casa Forno Center')->firstOrFail();
        $product = Product::where('slug', 'margherita-pizza')->firstOrFail();
        $product->branches()->updateExistingPivot($branch->id, ['price_override' => 12.00]);
        $large = ProductOption::where('name', 'Large')->firstOrFail();
        $payload = [
            'branch_id' => $branch->id,
            'schedule_type' => 'asap',
            'expected_total' => 12.00,
            'items' => [['product_id' => $product->id, 'quantity' => 1, 'options' => [$large->id]]],
        ];

        $this->actingAs($customer)->withHeader('Idempotency-Key', 'price-review-order-001')->postJson('/api/orders', $payload)
            ->assertStatus(409)->assertJsonPath('quote.total', '14.50');
        $this->assertDatabaseCount('orders', 15);
        $payload['expected_total'] = 14.50;
        $this->withHeader('Idempotency-Key', 'price-review-order-001')->postJson('/api/orders', $payload)
            ->assertCreated()->assertJsonPath('order.total', '14.50');
        $this->assertDatabaseCount('orders', 16);
    }

    public function test_unavailable_product_is_rejected_before_order_creation(): void
    {
        $customer = User::where('email', 'test@example.com')->firstOrFail();
        $branch = Branch::where('name', 'Casa Forno Center')->firstOrFail();
        $product = Product::where('slug', 'tiramisu')->firstOrFail();
        $product->branches()->updateExistingPivot($branch->id, ['is_available' => false]);
        $this->actingAs($customer)->withHeader('Idempotency-Key', 'sold-item-order-001')->postJson('/api/orders', [
            'branch_id' => $branch->id,
            'schedule_type' => 'asap',
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])->assertUnprocessable();
        $this->assertDatabaseCount('orders', 15);
    }

    public function test_required_product_options_are_validated_by_the_server(): void
    {
        $customer = User::where('email', 'test@example.com')->firstOrFail();
        $branch = Branch::where('name', 'Casa Forno Center')->firstOrFail();
        $product = Product::where('slug', 'margherita-pizza')->firstOrFail();

        $this->actingAs($customer)->withHeader('Idempotency-Key', 'required-option-order-01')->postJson('/api/orders', [
            'branch_id' => $branch->id,
            'schedule_type' => 'asap',
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])->assertUnprocessable()->assertJsonValidationErrors('items');

        $this->assertDatabaseCount('orders', 15);
    }

    public function test_customer_and_manager_cancellation_rules_are_enforced_and_record_reasons(): void
    {
        $customer = User::where('email', 'test@example.com')->firstOrFail();
        $manager = User::where('email', 'manager@foodora.demo')->firstOrFail();
        $branch = Branch::where('name', 'Casa Forno Center')->firstOrFail();
        $productId = Product::where('slug', 'tiramisu')->value('id');
        $create = fn (string $key) => $this->actingAs($customer)->withHeader('Idempotency-Key', $key)->postJson('/api/orders', [
            'branch_id' => $branch->id,
            'schedule_type' => 'asap',
            'items' => [['product_id' => $productId, 'quantity' => 1]],
        ])->assertCreated();

        $pending = $create('cancel-pending-order-01')->json('order.id');
        $this->patchJson("/api/orders/{$pending}/status", ['status' => 'cancelled'])->assertOk()->assertJsonPath('status', 'cancelled');

        $accepted = $create('cancel-accepted-order-1')->json('order.id');
        $this->actingAs($manager)->patchJson("/api/orders/{$accepted}/status", ['status' => 'confirmed', 'eta_minutes' => 18])->assertOk();
        $this->actingAs($customer)->patchJson("/api/orders/{$accepted}/status", ['status' => 'cancelled'])->assertForbidden();
        $this->actingAs($manager)->patchJson("/api/orders/{$accepted}/status", ['status' => 'cancelled'])->assertUnprocessable();
        $this->patchJson("/api/orders/{$accepted}/status", ['status' => 'cancelled', 'reason' => 'Customer called to cancel.'])
            ->assertOk()->assertJsonPath('status', 'cancelled');
        $this->assertDatabaseHas('order_status_history', ['order_id' => $accepted, 'to_status' => 'cancelled', 'note' => 'Customer called to cancel.']);
    }

    public function test_scheduled_pickup_slot_capacity_is_enforced(): void
    {
        $customer = User::where('email', 'test@example.com')->firstOrFail();
        $branch = Branch::where('name', 'Casa Forno Center')->firstOrFail();
        $pickupAt = CarbonImmutable::now($branch->timezone)->addDay()->setTime(16, 0);
        BusinessHour::where('branch_id', $branch->id)->where('weekday', $pickupAt->dayOfWeek)->update(['orders_per_slot' => 1]);
        $payload = [
            'branch_id' => $branch->id,
            'schedule_type' => 'scheduled',
            'pickup_at' => $pickupAt->toIso8601String(),
            'items' => [['product_id' => Product::where('slug', 'tiramisu')->value('id'), 'quantity' => 1]],
        ];

        $this->actingAs($customer)->withHeader('Idempotency-Key', 'capacity-order-0001')->postJson('/api/orders', $payload)->assertCreated();
        $this->withHeader('Idempotency-Key', 'capacity-order-0002')->postJson('/api/orders', $payload)->assertUnprocessable();
        $this->assertDatabaseCount('orders', 16);
    }

    public function test_cancelled_order_releases_its_scheduled_pickup_slot(): void
    {
        $customer = User::where('email', 'test@example.com')->firstOrFail();
        $branch = Branch::where('name', 'Casa Forno Center')->firstOrFail();
        $pickupAt = CarbonImmutable::now($branch->timezone)->addDay()->setTime(16, 0);
        BusinessHour::where('branch_id', $branch->id)->where('weekday', $pickupAt->dayOfWeek)->update(['orders_per_slot' => 1]);
        $created = $this->actingAs($customer)->withHeader('Idempotency-Key', 'cancel-release-slot-001')->postJson('/api/orders', [
            'branch_id' => $branch->id,
            'schedule_type' => 'scheduled',
            'pickup_at' => $pickupAt->toIso8601String(),
            'items' => [['product_id' => Product::where('slug', 'tiramisu')->value('id'), 'quantity' => 1]],
        ])->assertCreated();
        $orderId = $created->json('order.id');

        $this->getJson("/api/branches/{$branch->id}/pickup-slots?date={$pickupAt->toDateString()}")
            ->assertOk()->assertJsonMissing(['label' => '16:00']);
        $this->patchJson("/api/orders/{$orderId}/status", ['status' => 'cancelled'])->assertOk();
        $this->getJson("/api/branches/{$branch->id}/pickup-slots?date={$pickupAt->toDateString()}")
            ->assertOk()->assertJsonFragment(['label' => '16:00']);
    }

    public function test_menu_changes_do_not_mutate_existing_order_snapshots(): void
    {
        $customer = User::where('email', 'test@example.com')->firstOrFail();
        $product = Product::where('slug', 'tiramisu')->firstOrFail();
        $branch = Branch::where('name', 'Casa Forno Center')->firstOrFail();
        $created = $this->actingAs($customer)->withHeader('Idempotency-Key', 'snapshot-menu-change-01')->postJson('/api/orders', [
            'branch_id' => $branch->id,
            'schedule_type' => 'asap',
            'items' => [['product_id' => $product->id, 'quantity' => 2]],
        ])->assertCreated();
        $orderId = $created->json('order.id');

        $product->update(['name' => 'Renamed dessert', 'price' => 99]);
        $this->getJson("/api/orders/{$orderId}")->assertOk()
            ->assertJsonPath('items.0.product_name', 'Tiramisu')
            ->assertJsonPath('items.0.unit_price', '5.00')
            ->assertJsonPath('total', '10.00');
    }

    public function test_expired_eta_never_marks_an_order_ready_automatically(): void
    {
        $customer = User::where('email', 'test@example.com')->firstOrFail();
        $manager = User::where('email', 'manager@foodora.demo')->firstOrFail();
        $branch = Branch::where('name', 'Casa Forno Center')->firstOrFail();
        $created = $this->actingAs($customer)->withHeader('Idempotency-Key', 'eta-expiry-not-ready-01')->postJson('/api/orders', [
            'branch_id' => $branch->id,
            'schedule_type' => 'asap',
            'items' => [['product_id' => Product::where('slug', 'tiramisu')->value('id'), 'quantity' => 1]],
        ])->assertCreated();
        $orderId = $created->json('order.id');

        $this->actingAs($manager)->patchJson("/api/orders/{$orderId}/status", ['status' => 'confirmed', 'eta_minutes' => 1])->assertOk();
        $this->patchJson("/api/orders/{$orderId}/status", ['status' => 'preparing'])->assertOk();
        \App\Models\Order::whereKey($orderId)->update(['estimated_ready_at' => now()->subMinute()]);

        $this->getJson("/api/orders/{$orderId}")->assertOk()
            ->assertJsonPath('status', 'preparing')
            ->assertJsonStructure(['estimated_ready_at']);
    }

    public function test_kitchen_queue_is_branch_scoped_and_eta_updates_are_audited(): void
    {
        $customer = User::where('email', 'test@example.com')->firstOrFail();
        $manager = User::where('email', 'manager@foodora.demo')->firstOrFail();
        $kitchen = User::where('email', 'kitchen@foodora.demo')->firstOrFail();
        $branch = Branch::where('name', 'Casa Forno East')->firstOrFail();
        $productId = Product::where('slug', 'tiramisu')->value('id');
        $created = $this->actingAs($customer)->withHeader('Idempotency-Key', 'eta-queue-order-001')->postJson('/api/orders', [
            'branch_id' => $branch->id,
            'schedule_type' => 'asap',
            'items' => [['product_id' => $productId, 'quantity' => 1]],
        ])->assertCreated();
        $orderId = $created->json('order.id');

        $this->actingAs($manager)->patchJson("/api/orders/{$orderId}/status", ['status' => 'confirmed', 'eta_minutes' => 20])->assertOk();
        $this->actingAs($kitchen)->getJson('/api/kitchen/queue?station=packaging')->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($manager)->getJson('/api/kitchen/queue?station=packaging')->assertOk()->assertJsonPath('data.0.items.0.prep_station', 'packaging');
        $this->patchJson("/api/orders/{$orderId}/eta", ['eta_minutes' => 34, 'reason' => 'Kitchen is handling a busy period.'])
            ->assertOk()->assertJsonPath('eta_minutes', 34)->assertJsonPath('eta_history.1.eta_minutes', 34);
        $this->assertDatabaseHas('audit_logs', ['event' => 'order.eta_changed', 'subject_id' => $orderId]);
        $this->assertDatabaseHas('order_eta_history', ['order_id' => $orderId, 'eta_minutes' => 34]);
    }
}
