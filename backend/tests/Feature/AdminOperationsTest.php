<?php

namespace Tests\Feature;

use App\Models\Restaurant;
use App\Models\Branch;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Auth\Notifications\ResetPassword;
use Tests\TestCase;

class AdminOperationsTest extends TestCase
{
    use RefreshDatabase;

    protected $seed = true;

    public function test_admin_can_disable_accounts_but_cannot_disable_themselves(): void
    {
        $admin = User::where('email', 'admin@foodora.demo')->firstOrFail();
        $customer = User::where('email', 'test@example.com')->firstOrFail();

        $this->actingAs($customer)->getJson('/api/admin/users')->assertForbidden();
        $this->actingAs($admin)->patchJson("/api/admin/users/{$customer->id}/status", ['is_active' => false])
            ->assertOk()->assertJsonPath('data.is_active', false);
        $this->assertDatabaseHas('audit_logs', ['event' => 'user.status_changed', 'subject_id' => $customer->id]);
        $this->patchJson("/api/admin/users/{$admin->id}/status", ['is_active' => false])->assertUnprocessable();
    }

    public function test_only_administrator_can_approve_restaurants_and_manage_categories(): void
    {
        $restaurant = Restaurant::where('slug', 'casa-forno')->firstOrFail();
        $customer = User::where('email', 'test@example.com')->firstOrFail();
        $admin = User::where('email', 'admin@foodora.demo')->firstOrFail();

        $this->actingAs($customer)->patchJson("/api/admin/restaurants/{$restaurant->id}/status", ['status' => 'suspended'])->assertForbidden();
        $this->actingAs($admin)->patchJson("/api/admin/restaurants/{$restaurant->id}/status", ['status' => 'suspended'])->assertOk()->assertJsonPath('data.status', 'suspended');
        $this->assertDatabaseHas('audit_logs', ['event' => 'restaurant.status_changed', 'subject_id' => $restaurant->id]);

        $created = $this->actingAs($admin)->postJson("/api/admin/restaurants/{$restaurant->id}/categories", ['name' => 'Sides & dips']);
        $created->assertCreated()->assertJsonPath('data.slug', 'sides-dips');
        $categoryId = $created->json('data.id');

        $this->patchJson("/api/admin/restaurants/{$restaurant->id}/categories/{$categoryId}", ['is_active' => false])
            ->assertOk()->assertJsonPath('data.is_active', false);

        $otherRestaurant = Restaurant::where('slug', 'urban-grill')->firstOrFail();
        $this->patchJson("/api/admin/restaurants/{$otherRestaurant->id}/categories/{$categoryId}", ['name' => 'Wrong owner'])
            ->assertNotFound();
    }

    public function test_admin_status_endpoint_rejects_unknown_status(): void
    {
        $admin = User::where('email', 'admin@foodora.demo')->firstOrFail();
        $restaurant = Restaurant::where('slug', 'casa-forno')->firstOrFail();

        $this->actingAs($admin)->patchJson("/api/admin/restaurants/{$restaurant->id}/status", ['status' => 'deleted'])
            ->assertUnprocessable();
    }

    public function test_only_admin_can_assign_branch_staff_and_remove_last_assignment(): void
    {
        $admin = User::where('email', 'admin@foodora.demo')->firstOrFail();
        $customer = User::where('email', 'customer2@example.com')->firstOrFail();
        $branch = Branch::whereHas('restaurant', fn ($query) => $query->where('slug', 'urban-grill'))->firstOrFail();

        $this->actingAs($customer)->postJson("/api/admin/branches/{$branch->id}/staff", [
            'user_id' => $customer->id,
            'role' => User::ROLE_PICKUP,
        ])->assertForbidden();

        $this->actingAs($admin)->postJson("/api/admin/branches/{$branch->id}/staff", [
            'user_id' => $customer->id,
            'role' => User::ROLE_PICKUP,
        ])->assertOk()->assertJsonPath('data.role', User::ROLE_PICKUP);
        $this->assertDatabaseHas('branch_staff', ['branch_id' => $branch->id, 'user_id' => $customer->id, 'role' => User::ROLE_PICKUP]);
        $this->assertDatabaseHas('audit_logs', ['event' => 'staff.assigned', 'subject_id' => $customer->id]);

        $this->actingAs($admin)->getJson("/api/admin/branches/{$branch->id}/staff")
            ->assertOk()->assertJsonFragment(['email' => 'customer2@example.com', 'branch_role' => User::ROLE_PICKUP]);

        $this->deleteJson("/api/admin/branches/{$branch->id}/staff/{$customer->id}")->assertOk();
        $this->assertDatabaseMissing('branch_staff', ['branch_id' => $branch->id, 'user_id' => $customer->id]);
        $this->assertDatabaseHas('users', ['id' => $customer->id, 'role' => User::ROLE_CUSTOMER]);
        $this->assertDatabaseHas('audit_logs', ['event' => 'staff.removed', 'subject_id' => $customer->id]);
    }

    public function test_admin_can_create_manager_and_assign_all_active_branches_for_selected_restaurants(): void
    {
        Notification::fake();
        $admin = User::where('email', 'admin@foodora.demo')->firstOrFail();
        $restaurant = Restaurant::where('slug', 'casa-forno')->firstOrFail();

        $this->actingAs(User::where('email', 'test@example.com')->firstOrFail())
            ->postJson('/api/admin/managers', [
                'name' => 'New Restaurant Manager',
                'email' => 'new.manager@example.com',
                'restaurant_ids' => [$restaurant->id],
            ])->assertForbidden();

        $response = $this->actingAs($admin)->postJson('/api/admin/managers', [
            'name' => 'New Restaurant Manager',
            'email' => 'NEW.MANAGER@example.com',
            'restaurant_ids' => [$restaurant->id],
        ])->assertCreated()
            ->assertJsonPath('data.role', User::ROLE_MANAGER)
            ->assertJsonPath('reset_link_sent', true);

        $manager = User::findOrFail($response->json('data.id'));
        $this->assertDatabaseHas('branch_staff', ['user_id' => $manager->id, 'role' => User::ROLE_MANAGER]);
        $this->assertSame(
            $restaurant->branches()->where('is_active', true)->count(),
            $manager->staffBranches()->count(),
        );
        $this->assertDatabaseHas('audit_logs', ['event' => 'manager.created', 'subject_id' => $manager->id]);
        Notification::assertSentTo($manager, ResetPassword::class);
    }

    public function test_admin_role_changes_are_protected_and_last_admin_cannot_be_demoted(): void
    {
        $admin = User::where('email', 'admin@foodora.demo')->firstOrFail();
        $customer = User::where('email', 'customer2@example.com')->firstOrFail();

        $this->actingAs($customer)->patchJson("/api/admin/users/{$customer->id}/administrator", ['is_administrator' => true])->assertForbidden();
        $this->actingAs($admin)->patchJson("/api/admin/users/{$customer->id}/administrator", ['is_administrator' => true])
            ->assertOk()->assertJsonPath('data.role', User::ROLE_ADMIN);
        $this->assertDatabaseHas('audit_logs', ['event' => 'user.administrator_role_changed', 'subject_id' => $customer->id]);

        $this->patchJson("/api/admin/users/{$admin->id}/administrator", ['is_administrator' => false])->assertUnprocessable();
        $this->patchJson("/api/admin/users/{$customer->id}/administrator", ['is_administrator' => false])
            ->assertOk()->assertJsonPath('data.role', User::ROLE_CUSTOMER);
    }
}
