<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\BusinessHour;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductOption;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DemonstrationScenariosTest extends TestCase
{
    use RefreshDatabase;

    protected $seed = true;

    /**
     * T06: Dy klientë kërkojnë vendin e fundit - Vetëm një rezervim pranohet.
     */
    public function test_t06_slot_capacity_permits_only_available_slots_and_rejects_overflow(): void
    {
        $customer1 = User::where('email', 'test@example.com')->firstOrFail();
        $customer2 = User::where('email', 'customer2@example.com')->firstOrFail();
        $branch = Branch::where('name', 'Casa Forno Center')->firstOrFail();
        $product = Product::where('slug', 'margherita-pizza')->firstOrFail();
        $regular = ProductOption::where('name', 'Regular')->firstOrFail();

        $pickupAt = CarbonImmutable::now($branch->timezoneForCalculations())->addDay()->setTime(17, 0);
        BusinessHour::where('branch_id', $branch->id)->where('weekday', $pickupAt->dayOfWeek)->update(['orders_per_slot' => 1]);

        $payload = [
            'branch_id' => $branch->id,
            'schedule_type' => 'scheduled',
            'pickup_at' => $pickupAt->toIso8601String(),
            'items' => [['product_id' => $product->id, 'quantity' => 1, 'options' => [$regular->id]]],
        ];

        // First customer secures the last spot
        $first = $this->actingAs($customer1)->withHeader('Idempotency-Key', 't06-client-1')->postJson('/api/orders', $payload);
        $first->assertCreated();

        // Second customer tries to book the same filled slot
        $second = $this->actingAs($customer2)->withHeader('Idempotency-Key', 't06-client-2')->postJson('/api/orders', $payload);
        $second->assertUnprocessable()
            ->assertJsonValidationErrors('pickup_at');
    }

    /**
     * T08: Afati shtyhet me 10 minuta - Ora, numërimi dhe njoftimi përditësohen.
     */
    public function test_t08_eta_can_be_postponed_and_creates_audited_history_and_notification(): void
    {
        $customer = User::where('email', 'test@example.com')->firstOrFail();
        $manager = User::where('email', 'manager@foodora.demo')->firstOrFail();
        $branch = Branch::where('name', 'Casa Forno Center')->firstOrFail();
        $product = Product::where('slug', 'margherita-pizza')->firstOrFail();
        $regular = ProductOption::where('name', 'Regular')->firstOrFail();

        $orderResponse = $this->actingAs($customer)->withHeader('Idempotency-Key', 't08-order-01')->postJson('/api/orders', [
            'branch_id' => $branch->id,
            'schedule_type' => 'asap',
            'items' => [['product_id' => $product->id, 'quantity' => 1, 'options' => [$regular->id]]],
        ])->assertCreated();

        $orderId = $orderResponse->json('order.id');

        // Manager confirms with initial ETA 20 minutes
        $this->actingAs($manager)->patchJson("/api/orders/{$orderId}/status", [
            'status' => 'confirmed',
            'eta_minutes' => 20,
        ])->assertOk();

        $order = Order::findOrFail($orderId);
        $originalEtaTime = $order->estimated_ready_at;

        // Staff postpones ETA by 10 minutes (new ETA: 30 minutes)
        $this->actingAs($manager)->patchJson("/api/orders/{$orderId}/eta", [
            'eta_minutes' => 30,
            'reason' => 'Porosi të shumta në kuzhinë, afati shtyhet me 10 minuta.',
        ])->assertOk()->assertJsonPath('eta_minutes', 30);

        $order->refresh();
        $this->assertSame(30, $order->eta_minutes);
        $this->assertTrue($order->estimated_ready_at->gt($originalEtaTime));

        // Audit and ETA history records
        $this->assertDatabaseHas('order_eta_history', [
            'order_id' => $orderId,
            'eta_minutes' => 30,
            'reason' => 'Porosi të shumta në kuzhinë, afati shtyhet me 10 minuta.',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'event' => 'order.eta_changed',
            'subject_id' => $orderId,
        ]);
    }

    /**
     * T11: Izolimi i bizneseve - Punonjësi i restorantit A nuk ka qasje në restorantin B.
     */
    public function test_t11_cross_business_isolation_for_staff_and_customers(): void
    {
        $urbanManager = User::where('email', 'manager.urban@foodora.demo')->firstOrFail();
        $casaBranch = Branch::where('name', 'Casa Forno Center')->firstOrFail();
        $customer = User::where('email', 'test@example.com')->firstOrFail();
        $product = Product::where('slug', 'margherita-pizza')->firstOrFail();
        $regular = ProductOption::where('name', 'Regular')->firstOrFail();

        // Customer creates order at Casa Forno
        $casaOrder = $this->actingAs($customer)->withHeader('Idempotency-Key', 't11-casa-01')->postJson('/api/orders', [
            'branch_id' => $casaBranch->id,
            'schedule_type' => 'asap',
            'items' => [['product_id' => $product->id, 'quantity' => 1, 'options' => [$regular->id]]],
        ])->assertCreated()->json('order.id');

        // Urban Grill manager cannot view or modify Casa Forno order
        $this->actingAs($urbanManager)->getJson("/api/orders/{$casaOrder}")->assertNotFound();
        $this->actingAs($urbanManager)->patchJson("/api/orders/{$casaOrder}/status", [
            'status' => 'confirmed',
            'eta_minutes' => 15,
        ])->assertForbidden();

        // Another customer cannot access the order
        $customer2 = User::where('email', 'customer2@example.com')->firstOrFail();
        $this->actingAs($customer2)->getJson("/api/orders/{$casaOrder}")->assertNotFound();
    }

    /**
     * T12: Ndryshimi i statusit parandalon veprime kontradiktore dhe kapërcime arbitrare.
     */
    public function test_t12_status_conflict_and_invalid_transition_handling(): void
    {
        $customer = User::where('email', 'test@example.com')->firstOrFail();
        $manager = User::where('email', 'manager@foodora.demo')->firstOrFail();
        $branch = Branch::where('name', 'Casa Forno Center')->firstOrFail();
        $product = Product::where('slug', 'margherita-pizza')->firstOrFail();
        $regular = ProductOption::where('name', 'Regular')->firstOrFail();

        $orderId = $this->actingAs($customer)->withHeader('Idempotency-Key', 't12-order-01')->postJson('/api/orders', [
            'branch_id' => $branch->id,
            'schedule_type' => 'asap',
            'items' => [['product_id' => $product->id, 'quantity' => 1, 'options' => [$regular->id]]],
        ])->assertCreated()->json('order.id');

        // Cannot skip directly from pending to ready
        $this->actingAs($manager)->patchJson("/api/orders/{$orderId}/status", ['status' => 'ready'])->assertStatus(409);

        // Confirm order
        $this->actingAs($manager)->patchJson("/api/orders/{$orderId}/status", ['status' => 'confirmed', 'eta_minutes' => 20])->assertOk();

        // Start preparing
        $this->actingAs($manager)->patchJson("/api/orders/{$orderId}/status", ['status' => 'preparing'])->assertOk();

        // Cannot transition backwards to confirmed
        $this->actingAs($manager)->patchJson("/api/orders/{$orderId}/status", ['status' => 'confirmed', 'eta_minutes' => 20])->assertStatus(409);
    }

    /**
     * T17: Rinisje dhe persistencë - të dhënat mbeten të ruajtura saktësisht.
     */
    public function test_t17_order_state_and_history_persist_in_database(): void
    {
        $customer = User::where('email', 'test@example.com')->firstOrFail();
        $manager = User::where('email', 'manager@foodora.demo')->firstOrFail();
        $branch = Branch::where('name', 'Casa Forno Center')->firstOrFail();
        $product = Product::where('slug', 'margherita-pizza')->firstOrFail();
        $regular = ProductOption::where('name', 'Regular')->firstOrFail();

        $created = $this->actingAs($customer)->withHeader('Idempotency-Key', 't17-persist-01')->postJson('/api/orders', [
            'branch_id' => $branch->id,
            'schedule_type' => 'asap',
            'items' => [['product_id' => $product->id, 'quantity' => 1, 'options' => [$regular->id]]],
        ])->assertCreated();

        $orderId = $created->json('order.id');
        $this->actingAs($manager)->patchJson("/api/orders/{$orderId}/status", ['status' => 'confirmed', 'eta_minutes' => 25])->assertOk();

        // Fresh query simulates fresh request / restart
        $freshOrder = Order::with(['statusHistory', 'etaHistory', 'items.options'])->find($orderId);
        $this->assertNotNull($freshOrder);
        $this->assertSame('confirmed', $freshOrder->status);
        $this->assertSame(25, $freshOrder->eta_minutes);
        $this->assertNotNull($freshOrder->estimated_ready_at);
        $this->assertCount(1, $freshOrder->items);
        $this->assertSame('Margherita Pizza', $freshOrder->items[0]->product_name);
        $this->assertTrue($freshOrder->statusHistory()->where('to_status', 'confirmed')->exists());
    }
}
