<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Route;
use Illuminate\Auth\Notifications\ResetPassword;
use App\Notifications\LoginVerificationCode;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    protected $seed = true;

    public function test_valid_login_returns_user_role_and_invalid_login_is_rejected(): void
    {
        Notification::fake();
        $customer = User::where('email', 'test@example.com')->firstOrFail();
        $this->postJson('/api/login', ['email' => 'test@example.com', 'password' => 'password'])
            ->assertOk()->assertJsonPath('challenge_required', true);
        $this->getJson('/api/user')->assertUnauthorized();
        $code = Notification::sent($customer, LoginVerificationCode::class)->first()->code;
        $this->postJson('/api/login/verify', ['code' => $code])
            ->assertOk()->assertJsonPath('user.role', User::ROLE_CUSTOMER);

        auth()->logout();
        $this->postJson('/api/login', ['email' => 'test@example.com', 'password' => 'wrong-password'])
            ->assertUnprocessable();
    }

    public function test_administrator_login_returns_role_used_to_show_admin_dashboard(): void
    {
        Notification::fake();
        $admin = User::where('email', 'admin@foodora.demo')->firstOrFail();
        $this->postJson('/api/login', ['email' => 'admin@foodora.demo', 'password' => 'password'])
            ->assertOk()->assertJsonPath('challenge_required', true);
        $code = Notification::sent($admin, LoginVerificationCode::class)->first()->code;
        $this->postJson('/api/login/verify', ['code' => $code])
            ->assertOk()->assertJsonPath('user.role', User::ROLE_ADMIN);
    }

    public function test_registration_always_creates_a_customer_even_if_role_is_submitted(): void
    {
        Notification::fake();
        $this->postJson('/api/register', [
            'name' => 'New User',
            'email' => 'new-user@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'role' => User::ROLE_ADMIN,
        ])->assertCreated()->assertJsonPath('user.role', User::ROLE_CUSTOMER)->assertJsonPath('challenge_required', true);

        $user = User::where('email', 'new-user@example.com')->firstOrFail();
        $this->assertTrue(Hash::check('password123', $user->password));
        $this->getJson('/api/user')->assertUnauthorized();
        $code = Notification::sent($user, LoginVerificationCode::class)->first()->code;
        $this->postJson('/api/login/verify', ['code' => $code])->assertOk()->assertJsonPath('user.role', User::ROLE_CUSTOMER);
        $this->assertNotNull($user->fresh()->email_verified_at);
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

    public function test_user_must_use_a_reset_link_to_change_password(): void
    {
        $customer = User::where('email', 'test@example.com')->firstOrFail();

        $this->postJson('/api/reset-password', [
            'email' => $customer->email,
            'password' => 'new-secret-password-123',
            'password_confirmation' => 'new-secret-password-123',
        ])->assertUnprocessable();

        Notification::fake();
        $this->postJson('/api/forgot-password', ['email' => $customer->email])
            ->assertAccepted()
            ->assertJsonPath('message', 'Nëse ekziston llogaria, do të dërgohet një lidhje për rivendosjen e fjalëkalimit.');
        Notification::assertSentTo($customer, ResetPassword::class);
        $resetNotification = Notification::sent($customer, ResetPassword::class)->first();
        $this->assertStringStartsWith('http://localhost:5173/reset-password?reset_token=', $resetNotification->toMail($customer)->actionUrl);

        $this->postJson('/api/reset-password', [
            'email' => $customer->email,
            'token' => $resetNotification->token,
            'password' => 'new-secret-password-123',
            'password_confirmation' => 'new-secret-password-123',
        ])->assertOk()->assertJsonPath('message', 'Fjalëkalimi u rivendos me sukses. Tani mund të kyçeni.');

        $customer->refresh();
        $this->assertTrue(Hash::check('new-secret-password-123', $customer->password));
        $this->postJson('/api/reset-password', [
            'email' => $customer->email,
            'token' => $resetNotification->token,
            'password' => 'another-password-123',
            'password_confirmation' => 'another-password-123',
        ])->assertUnprocessable();
    }

    public function test_forgot_password_response_does_not_reveal_unknown_emails(): void
    {
        Notification::fake();
        $response = $this->postJson('/api/forgot-password', ['email' => 'missing@example.com']);
        $response->assertAccepted()->assertJsonPath('message', 'Nëse ekziston llogaria, do të dërgohet një lidhje për rivendosjen e fjalëkalimit.');
        Notification::assertNothingSent();
    }

    public function test_inactive_user_cannot_login_or_keep_using_an_existing_session(): void
    {
        Notification::fake();
        $customer = User::where('email', 'test@example.com')->firstOrFail();
        $this->postJson('/api/login', ['email' => $customer->email, 'password' => 'password'])->assertOk();
        $code = Notification::sent($customer, LoginVerificationCode::class)->first()->code;
        $this->postJson('/api/login/verify', ['code' => $code])->assertOk();

        $customer->update(['is_active' => false]);
        $this->getJson('/api/user')->assertForbidden();
        auth()->logout();
        $this->postJson('/api/login', ['email' => $customer->email, 'password' => 'password'])->assertUnprocessable();
    }

    public function test_logout_invalidates_the_session_and_is_available_to_inactive_users(): void
    {
        $customer = User::where('email', 'test@example.com')->firstOrFail();
        $this->actingAs($customer)->postJson('/api/logout')->assertOk();
        $this->getJson('/api/user')->assertUnauthorized();

        $customer->update(['is_active' => false]);
        $this->actingAs($customer)->postJson('/api/logout')->assertOk();
    }

    public function test_all_private_api_routes_require_authentication_and_active_account(): void
    {
        $publicRoutes = [
            'api/restaurants', 'api/catalog/filters', 'api/restaurants/{restaurant}/branches',
            'api/branches/{branch}/products', 'api/branches/{branch}/pickup-slots',
            'api/csrf-cookie', 'api/login', 'api/register', 'api/forgot-password', 'api/reset-password',
            'api/login/verify', 'api/login/resend-code',
        ];

        foreach (Route::getRoutes() as $route) {
            if (! str_starts_with($route->uri(), 'api/') || in_array($route->uri(), $publicRoutes, true)) continue;
            $middleware = $route->gatherMiddleware();
            $this->assertContains('auth', $middleware, "{$route->uri()} must require authentication.");
            if ($route->uri() !== 'api/logout') {
                $this->assertContains('account.active', $middleware, "{$route->uri()} must reject inactive accounts.");
            }
        }

        $this->getJson('/api/admin/users')->assertUnauthorized();
        $this->getJson('/api/manager/branches')->assertUnauthorized();
        $this->getJson('/api/orders')->assertUnauthorized();
    }

    public function test_customer_order_list_only_contains_the_authenticated_customers_orders(): void
    {
        $customer = User::where('email', 'test@example.com')->firstOrFail();
        $otherCustomer = User::where('email', 'customer2@example.com')->firstOrFail();
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
            'idempotency_key' => 'other-customers-list-order',
        ]);

        $this->actingAs($customer)->getJson('/api/orders')->assertOk()->assertJsonMissing(['id' => $order->id]);
    }

    public function test_login_verification_code_can_be_resent_and_only_the_new_code_works(): void
    {
        Notification::fake();
        $customer = User::where('email', 'test@example.com')->firstOrFail();
        $this->postJson('/api/login', ['email' => $customer->email, 'password' => 'password'])->assertOk();
        $firstCode = Notification::sent($customer, LoginVerificationCode::class)->first()->code;

        $this->postJson('/api/login/resend-code')->assertOk();
        $codes = Notification::sent($customer, LoginVerificationCode::class);
        $newCode = $codes->last()->code;
        for ($attempt = 0; $newCode === $firstCode && $attempt < 2; $attempt++) {
            $this->postJson('/api/login/resend-code')->assertOk();
            $newCode = Notification::sent($customer, LoginVerificationCode::class)->last()->code;
        }
        $this->assertNotSame($firstCode, $newCode);

        $this->postJson('/api/login/verify', ['code' => $firstCode])->assertUnprocessable();
        $this->postJson('/api/login/verify', ['code' => $newCode])->assertOk();
    }

    public function test_login_code_expires_and_locks_after_five_wrong_attempts(): void
    {
        Notification::fake();
        $customer = User::where('email', 'test@example.com')->firstOrFail();
        $this->postJson('/api/login', ['email' => $customer->email, 'password' => 'password'])->assertOk();
        $code = Notification::sent($customer, LoginVerificationCode::class)->first()->code;
        $wrongCode = $code === '000000' ? '000001' : '000000';

        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->postJson('/api/login/verify', ['code' => $wrongCode])->assertUnprocessable();
        }
        $this->postJson('/api/login/verify', ['code' => $code])->assertUnprocessable();
        $this->getJson('/api/user')->assertUnauthorized();

        $this->travel(61)->seconds();
        $this->postJson('/api/login', ['email' => $customer->email, 'password' => 'password'])->assertOk();
        $this->travel(6)->minutes();
        $this->postJson('/api/login/verify', ['code' => Notification::sent($customer, LoginVerificationCode::class)->last()->code])
            ->assertUnprocessable();
    }
}
