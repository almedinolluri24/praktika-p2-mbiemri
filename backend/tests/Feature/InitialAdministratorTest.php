<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class InitialAdministratorTest extends TestCase
{
    use RefreshDatabase;

    public function test_initial_administrator_is_created_interactively_with_a_hashed_password(): void
    {
        User::query()->where('role', User::ROLE_ADMIN)->update(['role' => User::ROLE_CUSTOMER]);

        $this->artisan('admin:create-initial')
            ->expectsQuestion('Administrator name', 'First Administrator')
            ->expectsQuestion('Administrator email', 'first-admin@example.com')
            ->expectsQuestion('Administrator password (at least 12 characters)', 'StrongPassword!234')
            ->expectsQuestion('Confirm administrator password', 'StrongPassword!234')
            ->expectsOutput('Initial administrator created. You can now sign in with that email.')
            ->assertExitCode(0);

        $admin = User::where('email', 'first-admin@example.com')->firstOrFail();
        $this->assertSame(User::ROLE_ADMIN, $admin->role);
        $this->assertTrue(Hash::check('StrongPassword!234', $admin->password));
        $this->assertNotSame('StrongPassword!234', $admin->password);
    }

    public function test_initial_administrator_command_cannot_create_a_second_admin(): void
    {
        $userCount = User::count();
        User::create([
            'name' => 'Existing Administrator',
            'email' => 'existing-admin@example.com',
            'password' => 'StrongPassword!234',
            'role' => User::ROLE_ADMIN,
        ]);

        $this->artisan('admin:create-initial')
            ->expectsOutput('An administrator already exists. Ask an existing administrator to grant access.')
            ->assertExitCode(1);

        $this->assertDatabaseCount('users', $userCount + 1);
    }
}
