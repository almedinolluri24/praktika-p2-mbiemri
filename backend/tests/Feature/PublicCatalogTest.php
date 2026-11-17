<?php

namespace Tests\Feature;

use App\Models\Branch;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicCatalogTest extends TestCase
{
    use RefreshDatabase;

    protected $seed = true;

    public function test_seeded_catalog_has_seven_business_types_and_at_least_thirty_products(): void
    {
        $this->assertDatabaseCount('restaurants', 7);
        $this->assertDatabaseCount('products', 36);
        $this->assertDatabaseCount('option_groups', 6);
        $this->assertDatabaseCount('orders', 15);
        $this->assertDatabaseCount('users', 9);
        $this->assertDatabaseHas('restaurants', ['slug' => 'casa-forno']);
        $this->assertDatabaseHas('branches', ['name' => 'Casa Forno Center']);
        $this->assertDatabaseHas('branches', ['name' => 'Casa Forno East']);
        $this->assertDatabaseHas('branches', ['timezone' => 'Europe/Pristina']);
    }

    public function test_public_catalog_includes_open_state_for_each_branch(): void
    {
        $response = $this->getJson('/api/restaurants?per_page=10');
        $response->assertOk()->assertJsonStructure(['data' => [['branches' => [['is_open_now']]]]]);
    }

    public function test_public_restaurant_search_and_type_filter_are_applied_server_side(): void
    {
        $response = $this->getJson('/api/restaurants?search=Casa&business_type=pizzeria&per_page=5');

        $response->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.slug', 'casa-forno')
            ->assertJsonPath('data.0.branches_count', 2);
    }

    public function test_public_branch_menu_includes_options_and_supports_pagination(): void
    {
        $branch = Branch::where('name', 'Casa Forno Center')->firstOrFail();

        $response = $this->getJson("/api/branches/{$branch->id}/products?search=Pizza&per_page=1");

        $response->assertOk()
            ->assertJsonPath('total', 3)
            ->assertJsonPath('per_page', 1)
            ->assertJsonPath('data.0.name', 'Four Cheese Pizza')
            ->assertJsonPath('data.0.option_groups.0.name', 'Size')
            ->assertJsonStructure(['data' => [['allergens']]]);
    }

    public function test_public_catalog_does_not_expose_unapproved_restaurants(): void
    {
        $restaurant = \App\Models\Restaurant::where('slug', 'casa-forno')->firstOrFail();
        $restaurant->update(['status' => 'pending']);

        $this->getJson('/api/restaurants?search=Casa')->assertOk()->assertJsonPath('total', 0);

        $branch = $restaurant->branches()->firstOrFail();
        $this->getJson("/api/branches/{$branch->id}/products")->assertNotFound();
    }
}
