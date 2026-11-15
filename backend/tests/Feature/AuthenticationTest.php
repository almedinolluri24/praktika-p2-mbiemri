<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    protected $seed = true;

    public function test_valid_login_returns_user_role_and_invalid_login_is_rejected(): void
    {
        $this->postJson('/api/login', ['email' => 'test@example.com', 'password' => 'password'])
            ->assertOk()->assertJsonPath('user.role', User::ROLE_CUSTOMER);

        auth()->logout();
        $this->postJson('/api/login', ['email' => 'test@example.com', 'password' => 'wrong-password'])
            ->assertUnprocessable();
    }

    public function test_administrator_login_returns_role_used_to_show_admin_dashboard(): void
    {
        $this->postJson('/api/login', ['email' => 'admin@foodora.demo', 'password' => 'password'])
            ->assertOk()
            ->assertJsonPath('user.role', User::ROLE_ADMIN);
    }

    public function test_registration_always_creates_a_customer_even_if_role_is_submitted(): void
    {
        $this->postJson('/api/register', [
            'name' => 'New User',
            'email' => 'new-user@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'role' => User::ROLE_ADMIN,
        ])->assertCreated()->assertJsonPath('user.role', User::ROLE_CUSTOMER);

        $user = User::where('email', 'new-user@example.com')->firstOrFail();
        $this->assertTrue(Hash::check('password123', $user->password));
    }

    public function test_customer_can_update_profile_but_cannot_change_role(): void
    {
        $customer = User::where('email', 'test@example.com')->firstOrFail();

        $this->actingAs($customer)->patchJson('/api/profile', [
            'name' => 'Updated Customer',
            'email' => 'updated@example.com',
            'role' => User::ROLE_ADMIN,
        ])->assertOk()->assertJsonPath('user.name', 'Updated Customer')->assertJsonPath('user.email', 'updated@example.com')->assertJsonPath('user.role', User::ROLE_CUSTOMER);
    }

    public function test_user_cannot_read_another_customer_order(): void
    {
        $customer = User::where('email', 'test@example.com')->firstOrFail();
        $otherCustomer = User::create(['name' => 'Other Customer', 'email' => 'other@example.com', 'password' => 'password123', 'role' => User::ROLE_CUSTOMER]);
        $this->actingAs($customer)->withHeader('Idempotency-Key', 'private-order-0001')->postJson('/api/orders', [
            'branch_id' => 1,
            'schedule_type' => 'asap',
            'items' => [['product_id' => 1, 'quantity' => 1]],
        ])->assertUnprocessable();

        $order = \App\Models\Order::create([
            'branch_id' => 1,
            'customer_id' => $otherCustomer->id,
            'status' => 'pending_confirmation',
            'schedule_type' => 'asap',
            'pickup_at' => now()->addHour(),
            'payment_method' => 'cash_at_pickup',
            'payment_status' => 'unpaid',
            'subtotal' => 1,
            'total' => 1,
            'idempotency_key' => 'private-order-0002',
        ]);
        $this->getJson("/api/orders/{$order->id}")->assertNotFound();
    }

    public function test_user_can_reset_password_with_valid_confirmation(): void
    {
        $customer = User::where('email', 'test@example.com')->firstOrFail();

        $this->postJson('/api/reset-password', [
            'email' => $customer->email,
            'password' => 'new-secret-password-123',
            'password_confirmation' => 'new-secret-password-123',
        ])->assertOk()->assertJsonPath('message', 'Fjalëkalimi u rivendos me sukses. Tani mund të kyçeni.');

        $customer->refresh();
        $this->assertTrue(Hash::check('new-secret-password-123', $customer->password));
    }
}
