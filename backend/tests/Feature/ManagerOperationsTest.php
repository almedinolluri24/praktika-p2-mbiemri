<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\ProductCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ManagerOperationsTest extends TestCase
{
    use RefreshDatabase;

    protected $seed = true;

    public function test_manager_can_manage_branch_menu_and_cannot_cross_restaurant_scope(): void
    {
        $manager = User::where('email', 'manager@foodora.demo')->firstOrFail();
        $branch = Branch::where('name', 'Casa Forno Center')->firstOrFail();
        $otherBranch = Branch::where('name', 'Moka House Center')->firstOrFail();
        $category = ProductCategory::where('restaurant_id', $branch->restaurant_id)->firstOrFail();

        $this->actingAs($manager)->getJson('/api/manager/branches')->assertOk()->assertJsonFragment(['name' => 'Casa Forno Center']);
        $this->actingAs($manager)->getJson("/api/manager/branches/{$otherBranch->id}/products")->assertForbidden();

        $created = $this->postJson("/api/manager/branches/{$branch->id}/products", [
            'category_id' => $category->id,
            'name' => 'Demo manager special',
            'description' => 'Freshly prepared demo item.',
            'price' => 7.25,
            'allergens' => ['gluten', 'milk'],
            'prep_station' => 'oven',
            'prep_minutes' => 12,
        ])->assertCreated()->assertJsonPath('data.name', 'Demo manager special');

        $productId = $created->json('data.id');
        $this->postJson("/api/manager/branches/{$branch->id}/categories", ['name' => 'Seasonal specials'])
            ->assertCreated()->assertJsonPath('data.slug', 'seasonal-specials');
        $this->patchJson("/api/manager/branches/{$branch->id}/products/{$productId}", [
            'branch_price' => 8.00,
            'branch_available' => false,
        ])->assertOk()->assertJsonPath('data.price', '7.25');

        $this->assertDatabaseHas('branch_products', ['branch_id' => $branch->id, 'product_id' => $productId, 'price_override' => 8, 'is_available' => 0]);
        $this->assertDatabaseHas('audit_logs', ['event' => 'manager.product_created', 'subject_id' => $productId]);
    }

    public function test_manager_can_update_weekly_hours_and_read_branch_reports(): void
    {
        $manager = User::where('email', 'manager@foodora.demo')->firstOrFail();
        $branch = Branch::where('name', 'Casa Forno Center')->firstOrFail();
        $hours = collect(range(0, 6))->map(fn (int $weekday) => [
            'weekday' => $weekday,
            'is_closed' => $weekday === 0,
            'opens_at' => $weekday === 0 ? null : '10:00',
            'closes_at' => $weekday === 0 ? null : '21:00',
            'slot_interval_minutes' => 15,
            'orders_per_slot' => 6,
        ])->all();

        $this->actingAs($manager)->putJson("/api/manager/branches/{$branch->id}/hours", ['hours' => $hours])
            ->assertOk()->assertJsonCount(7, 'data');
        $this->getJson("/api/manager/branches/{$branch->id}/reports")
            ->assertOk()->assertJsonStructure(['data' => ['orders_total', 'orders_by_status', 'paid_revenue', 'completed_orders', 'average_preparation_minutes', 'late_orders', 'bestsellers']]);
    }

    public function test_manager_can_assign_and_remove_kitchen_or_pickup_staff_only_in_managed_branch(): void
    {
        $manager = User::where('email', 'manager@foodora.demo')->firstOrFail();
        $customer = User::where('email', 'customer2@example.com')->firstOrFail();
        $branch = Branch::where('name', 'Casa Forno Center')->firstOrFail();
        $otherBranch = Branch::where('name', 'Urban Grill Center')->firstOrFail();

        $this->actingAs($manager)->postJson("/api/manager/branches/{$branch->id}/staff", [
            'email' => $customer->email,
            'role' => User::ROLE_KITCHEN,
        ])->assertOk();
        $this->assertDatabaseHas('branch_staff', ['branch_id' => $branch->id, 'user_id' => $customer->id, 'role' => User::ROLE_KITCHEN]);
        $this->getJson("/api/manager/branches/{$branch->id}/staff")->assertOk()->assertJsonFragment(['email' => $customer->email]);
        $this->postJson("/api/manager/branches/{$otherBranch->id}/staff", ['email' => $customer->email, 'role' => User::ROLE_PICKUP])->assertForbidden();

        $this->deleteJson("/api/manager/branches/{$branch->id}/staff/{$customer->id}")->assertOk();
        $this->assertDatabaseMissing('branch_staff', ['branch_id' => $branch->id, 'user_id' => $customer->id]);
        $this->assertDatabaseHas('users', ['id' => $customer->id, 'role' => User::ROLE_CUSTOMER]);
        $this->assertDatabaseHas('audit_logs', ['event' => 'manager.staff_assigned', 'subject_id' => $customer->id]);
        $this->assertDatabaseHas('audit_logs', ['event' => 'manager.staff_removed', 'subject_id' => $customer->id]);
    }
}
