<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BroadcastAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    protected $seed = true;

    public function test_private_branch_and_customer_channels_are_restricted_to_their_owners(): void
    {
        $manager = User::where('email', 'manager@foodora.demo')->firstOrFail();
        $otherManager = User::where('email', 'manager.urban@foodora.demo')->firstOrFail();
        $customer = User::where('email', 'test@example.com')->firstOrFail();
        $otherCustomer = User::where('email', 'customer2@example.com')->firstOrFail();
        $casa = Branch::where('name', 'Casa Forno Center')->firstOrFail();
        $urban = Branch::where('name', 'Urban Grill Center')->firstOrFail();

        $this->actingAs($manager)->postJson('/broadcasting/auth', ['socket_id' => '1234.5678', 'channel_name' => "private-branches.{$casa->id}"])->assertOk();
        $this->postJson('/broadcasting/auth', ['socket_id' => '1234.5678', 'channel_name' => "private-branches.{$urban->id}"])->assertForbidden();
        $this->actingAs($otherManager)->postJson('/broadcasting/auth', ['socket_id' => '1234.5678', 'channel_name' => "private-branches.{$urban->id}"])->assertOk();

        $order = Order::where('customer_id', $customer->id)->firstOrFail();
        $this->actingAs($customer)->postJson('/broadcasting/auth', ['socket_id' => '1234.5678', 'channel_name' => "private-orders.customer.{$customer->id}"])->assertOk();
        $this->postJson('/broadcasting/auth', ['socket_id' => '1234.5678', 'channel_name' => "private-orders.customer.{$otherCustomer->id}"])->assertForbidden();
        $this->postJson('/broadcasting/auth', ['socket_id' => '1234.5678', 'channel_name' => "private-orders.{$order->id}"])->assertOk();
    }
}
