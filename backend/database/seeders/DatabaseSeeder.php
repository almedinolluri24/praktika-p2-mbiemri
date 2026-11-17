<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\BusinessHour;
use App\Models\Order;
use App\Models\OptionGroup;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductOption;
use App\Models\Restaurant;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            return;
        }

        DB::transaction(function (): void {
            $demoUsers = $this->seedDemoUsers();
            $optionGroups = $this->seedOptionGroups();
            $this->seedBusinesses($demoUsers, $optionGroups);
            $this->seedDemoOrders($demoUsers);
        });
    }

    private function seedDemoUsers(): array
    {
        if (! app()->environment(['local', 'testing'])) {
            return [];
        }

        $password = Hash::make(env('DEMO_PASSWORD', 'password'));
        $adminEmail = strtolower(trim((string) env('DEMO_ADMIN_EMAIL', 'admin@foodora.demo')));
        $adminName = trim((string) env('DEMO_ADMIN_NAME', 'Foodora Administrator')) ?: 'Foodora Administrator';
        $adminPassword = Hash::make(env('DEMO_ADMIN_PASSWORD', env('DEMO_PASSWORD', 'password')));
        if ($adminEmail !== 'admin@foodora.demo') {
            User::where('email', 'admin@foodora.demo')->where('role', User::ROLE_ADMIN)->update(['role' => User::ROLE_CUSTOMER]);
        }
        $accounts = [
            'test@example.com' => ['Test Customer', User::ROLE_CUSTOMER],
            'customer2@example.com' => ['Demo Customer Two', User::ROLE_CUSTOMER],
            'manager@foodora.demo' => ['Demo Restaurant Manager', User::ROLE_MANAGER],
            'kitchen@foodora.demo' => ['Demo Kitchen Worker', User::ROLE_KITCHEN],
            'pickup@foodora.demo' => ['Demo Pickup Worker', User::ROLE_PICKUP],
            'manager.urban@foodora.demo' => ['Urban Grill Manager', User::ROLE_MANAGER],
            'kitchen.urban@foodora.demo' => ['Urban Grill Kitchen Worker', User::ROLE_KITCHEN],
            'pickup.urban@foodora.demo' => ['Urban Grill Pickup Worker', User::ROLE_PICKUP],
            $adminEmail => [$adminName, User::ROLE_ADMIN],
        ];
        $accountPasswords = [$adminEmail => $adminPassword];

        $users = [];
        foreach ($accounts as $email => [$name, $role]) {
            $user = User::updateOrCreate(
                ['email' => $email],
                ['name' => $name, 'password' => $accountPasswords[$email] ?? $password, 'role' => $role],
            );
            $users[$role] ??= $user;
            $users[$email] = $user;
        }

        return $users;
    }

    private function seedOptionGroups(): array
    {
        $groups = [
            'Size' => ['required' => true, 'min' => 1, 'max' => 1, 'options' => [['Regular', 0], ['Large', 2.50]]],
            'Crust' => ['required' => false, 'min' => 0, 'max' => 1, 'options' => [['Classic', 0], ['Thin', 0], ['Stuffed crust', 3.00]]],
            'Extra toppings' => ['required' => false, 'min' => 0, 'max' => 4, 'options' => [['Extra cheese', 1.50], ['Olives', 0.75], ['Mushrooms', 0.90], ['Jalapeños', 0.80]]],
            'Milk choice' => ['required' => false, 'min' => 0, 'max' => 1, 'options' => [['Whole milk', 0], ['Oat milk', 0.80], ['Almond milk', 0.80]]],
            'Protein add-on' => ['required' => false, 'min' => 0, 'max' => 2, 'options' => [['Grilled chicken', 2.50], ['Avocado', 1.75], ['Bacon', 2.00]]],
            'Spice level' => ['required' => false, 'min' => 0, 'max' => 1, 'options' => [['Mild', 0], ['Medium', 0], ['Hot', 0]]],
        ];

        $result = [];
        foreach ($groups as $name => $definition) {
            $group = OptionGroup::updateOrCreate(
                ['restaurant_id' => null, 'name' => $name],
                [
                    'is_required' => $definition['required'],
                    'min_selections' => $definition['min'],
                    'max_selections' => $definition['max'],
                    'sort_order' => count($result),
                ],
            );

            foreach ($definition['options'] as $index => [$optionName, $price]) {
                ProductOption::updateOrCreate(
                    ['option_group_id' => $group->id, 'name' => $optionName],
                    ['price_delta' => $price, 'sort_order' => $index, 'is_available' => true],
                );
            }

            $result[$name] = $group;
        }

        return $result;
    }

    private function seedBusinesses(array $demoUsers, array $optionGroups): void
    {
        $businesses = [
            [
                'name' => 'Casa Forno', 'slug' => 'casa-forno', 'type' => 'pizzeria', 'category' => 'Pizza',
                'branches' => [
                    ['name' => 'Casa Forno Center', 'city' => 'Prishtina', 'address' => 'Mother Teresa Boulevard 12', 'phone' => '+383 44 111 222', 'pickup_instructions' => 'Hyni në restorant te banaku kryesor dhe paraqisni kodin QR te stafi i arkës.'],
                    ['name' => 'Casa Forno East', 'city' => 'Prishtina', 'address' => 'Bregu i Diellit 4', 'phone' => '+383 44 111 223', 'pickup_instructions' => 'Sporteli i marrjes ndodhet në hyrjen anësore. Tregoni kodin e porosisë.'],
                ],
                'products' => [
                    ['name' => 'Margherita Pizza', 'slug' => 'margherita-pizza', 'description' => 'San Marzano tomato, mozzarella and fresh basil.', 'price' => 9.50, 'minutes' => 18, 'station' => 'pizza', 'allergens' => ['gluten', 'dairy'], 'groups' => ['Size', 'Crust', 'Extra toppings']],
                    ['name' => 'Pepperoni Pizza', 'slug' => 'pepperoni-pizza', 'description' => 'Classic pepperoni with mozzarella and tomato sauce.', 'price' => 11.50, 'minutes' => 20, 'station' => 'pizza', 'allergens' => ['gluten', 'dairy'], 'groups' => ['Size', 'Crust', 'Extra toppings']],
                    ['name' => 'Four Cheese Pizza', 'slug' => 'four-cheese-pizza', 'description' => 'Mozzarella, gorgonzola, parmesan and provolone.', 'price' => 12.00, 'minutes' => 20, 'station' => 'pizza', 'allergens' => ['gluten', 'dairy'], 'groups' => ['Size', 'Crust']],
                    ['name' => 'Garlic Bread', 'slug' => 'garlic-bread', 'description' => 'Warm baked bread with garlic butter and herbs.', 'price' => 4.00, 'minutes' => 10, 'station' => 'pizza', 'allergens' => ['gluten', 'dairy'], 'groups' => ['Extra toppings']],
                    ['name' => 'Penne Alfredo', 'slug' => 'penne-alfredo', 'description' => 'Penne pasta in a creamy parmesan sauce.', 'price' => 8.50, 'minutes' => 16, 'station' => 'grill', 'allergens' => ['gluten', 'dairy'], 'groups' => ['Protein add-on', 'Spice level']],
                    ['name' => 'Tiramisu', 'slug' => 'tiramisu', 'description' => 'Espresso-soaked sponge, mascarpone and cocoa.', 'price' => 5.00, 'minutes' => 3, 'station' => 'packaging', 'allergens' => ['gluten', 'dairy', 'eggs'], 'groups' => []],
                ],
            ],
            [
                'name' => 'Urban Grill', 'slug' => 'urban-grill', 'type' => 'fast_food', 'category' => 'Burgers',
                'branches' => [['name' => 'Urban Grill Center', 'city' => 'Prishtina', 'address' => 'Rruga B 18', 'phone' => '+383 44 222 333', 'pickup_instructions' => 'Pika e marrjes është në sportelin ekspres majtas hyrjes.']],
                'products' => [
                    ['name' => 'Classic Smash Burger', 'slug' => 'classic-smash-burger', 'description' => 'Double smashed beef, cheddar and house sauce.', 'price' => 8.50, 'minutes' => 14, 'station' => 'grill', 'allergens' => ['gluten', 'dairy', 'mustard'], 'groups' => ['Extra toppings', 'Spice level']],
                    ['name' => 'Crispy Chicken Burger', 'slug' => 'crispy-chicken-burger', 'description' => 'Crispy chicken, lettuce and tangy pickles.', 'price' => 7.50, 'minutes' => 15, 'station' => 'grill', 'allergens' => ['gluten', 'eggs'], 'groups' => ['Extra toppings', 'Spice level']],
                    ['name' => 'BBQ Bacon Burger', 'slug' => 'bbq-bacon-burger', 'description' => 'Beef patty, bacon, smoked cheddar and BBQ sauce.', 'price' => 9.50, 'minutes' => 16, 'station' => 'grill', 'allergens' => ['gluten', 'dairy'], 'groups' => ['Extra toppings', 'Spice level']],
                    ['name' => 'Truffle Fries', 'slug' => 'truffle-fries', 'description' => 'Crispy fries with parmesan and truffle seasoning.', 'price' => 4.50, 'minutes' => 8, 'station' => 'grill', 'allergens' => ['dairy'], 'groups' => ['Extra toppings']],
                    ['name' => 'Grilled Chicken Wrap', 'slug' => 'grilled-chicken-wrap', 'description' => 'Grilled chicken, greens and garlic yogurt sauce.', 'price' => 7.00, 'minutes' => 12, 'station' => 'grill', 'allergens' => ['gluten', 'dairy'], 'groups' => ['Extra toppings', 'Spice level']],
                    ['name' => 'Onion Rings', 'slug' => 'onion-rings', 'description' => 'Golden battered onion rings with dip.', 'price' => 3.75, 'minutes' => 8, 'station' => 'grill', 'allergens' => ['gluten'], 'groups' => []],
                ],
            ],
            [
                'name' => 'Moka House', 'slug' => 'moka-house', 'type' => 'cafe', 'category' => 'Cafe',
                'branches' => [['name' => 'Moka House Center', 'city' => 'Prishtina', 'address' => 'Mother Teresa Boulevard 31', 'phone' => '+383 44 333 444', 'pickup_instructions' => 'Merrni porosinë te banaku i kafenesë duke treguar kodin e verifikimit.']],
                'products' => [
                    ['name' => 'Cappuccino', 'slug' => 'cappuccino', 'description' => 'Double espresso with steamed milk and foam.', 'price' => 2.50, 'minutes' => 5, 'station' => 'drinks', 'allergens' => ['dairy'], 'groups' => ['Size', 'Milk choice']],
                    ['name' => 'Iced Latte', 'slug' => 'iced-latte', 'description' => 'Espresso and chilled milk over ice.', 'price' => 3.25, 'minutes' => 4, 'station' => 'drinks', 'allergens' => ['dairy'], 'groups' => ['Size', 'Milk choice']],
                    ['name' => 'Cold Brew', 'slug' => 'cold-brew', 'description' => 'Slow-steeped coffee served chilled.', 'price' => 3.00, 'minutes' => 3, 'station' => 'drinks', 'allergens' => [], 'groups' => ['Size']],
                    ['name' => 'Avocado Toast', 'slug' => 'avocado-toast', 'description' => 'Sourdough toast, avocado, lemon and seeds.', 'price' => 6.50, 'minutes' => 10, 'station' => 'grill', 'allergens' => ['gluten', 'sesame'], 'groups' => ['Protein add-on', 'Spice level']],
                    ['name' => 'Cinnamon Roll', 'slug' => 'cinnamon-roll', 'description' => 'Soft cinnamon roll with vanilla glaze.', 'price' => 3.25, 'minutes' => 3, 'station' => 'packaging', 'allergens' => ['gluten', 'dairy', 'eggs'], 'groups' => []],
                    ['name' => 'Chocolate Brownie', 'slug' => 'chocolate-brownie', 'description' => 'Rich cocoa brownie with dark chocolate.', 'price' => 3.50, 'minutes' => 3, 'station' => 'packaging', 'allergens' => ['gluten', 'dairy', 'eggs'], 'groups' => []],
                ],
            ],
            [
                'name' => 'Daily Crumb', 'slug' => 'daily-crumb', 'type' => 'bakery', 'category' => 'Bakery',
                'branches' => [['name' => 'Daily Crumb Center', 'city' => 'Prishtina', 'address' => 'UÇK Street 7', 'phone' => '+383 44 444 555', 'pickup_instructions' => 'Sporteli i furrës në qendër. Paraqisni kodin njëpërdorimësh.']],
                'products' => [
                    ['name' => 'Butter Croissant', 'slug' => 'butter-croissant', 'description' => 'Flaky, hand-folded butter croissant.', 'price' => 2.20, 'minutes' => 2, 'station' => 'packaging', 'allergens' => ['gluten', 'dairy', 'eggs'], 'groups' => []],
                    ['name' => 'Almond Croissant', 'slug' => 'almond-croissant', 'description' => 'Butter croissant filled with almond cream.', 'price' => 2.80, 'minutes' => 2, 'station' => 'packaging', 'allergens' => ['gluten', 'dairy', 'eggs', 'nuts'], 'groups' => []],
                    ['name' => 'Sourdough Loaf', 'slug' => 'sourdough-loaf', 'description' => 'Naturally leavened country sourdough loaf.', 'price' => 4.50, 'minutes' => 2, 'station' => 'packaging', 'allergens' => ['gluten'], 'groups' => []],
                    ['name' => 'Spinach Feta Borek', 'slug' => 'spinach-feta-borek', 'description' => 'Crisp pastry with spinach and feta filling.', 'price' => 3.25, 'minutes' => 6, 'station' => 'oven', 'allergens' => ['gluten', 'dairy', 'eggs'], 'groups' => []],
                    ['name' => 'Blueberry Muffin', 'slug' => 'blueberry-muffin', 'description' => 'Buttermilk muffin with fresh blueberries.', 'price' => 2.75, 'minutes' => 2, 'station' => 'packaging', 'allergens' => ['gluten', 'dairy', 'eggs'], 'groups' => []],
                    ['name' => 'Focaccia Slice', 'slug' => 'focaccia-slice', 'description' => 'Olive oil focaccia with rosemary and sea salt.', 'price' => 2.50, 'minutes' => 4, 'station' => 'oven', 'allergens' => ['gluten'], 'groups' => []],
                ],
            ],
            [
                'name' => 'Green Table', 'slug' => 'green-table', 'type' => 'healthy_kitchen', 'category' => 'Healthy bowls',
                'branches' => [['name' => 'Green Table Center', 'city' => 'Prishtina', 'address' => 'Bulevardi Bill Clinton 9', 'phone' => '+383 44 555 666', 'pickup_instructions' => 'Shkoni te rafti "Pickup Orders" dhe konfirmoni kodin me banakierin.']],
                'products' => [
                    ['name' => 'Green Goddess Bowl', 'slug' => 'green-goddess-bowl', 'description' => 'Quinoa, avocado, greens and lemon tahini.', 'price' => 8.50, 'minutes' => 12, 'station' => 'grill', 'allergens' => ['sesame'], 'groups' => ['Protein add-on', 'Spice level']],
                    ['name' => 'Rainbow Buddha Bowl', 'slug' => 'rainbow-buddha-bowl', 'description' => 'Roasted vegetables, grains and herb dressing.', 'price' => 8.00, 'minutes' => 12, 'station' => 'grill', 'allergens' => [], 'groups' => ['Protein add-on', 'Spice level']],
                    ['name' => 'Chicken Caesar Salad', 'slug' => 'chicken-caesar-salad', 'description' => 'Grilled chicken, romaine, parmesan and croutons.', 'price' => 8.75, 'minutes' => 10, 'station' => 'grill', 'allergens' => ['dairy', 'eggs', 'gluten'], 'groups' => ['Protein add-on']],
                    ['name' => 'Mango Smoothie', 'slug' => 'mango-smoothie', 'description' => 'Mango, banana and oat milk blended fresh.', 'price' => 4.50, 'minutes' => 5, 'station' => 'drinks', 'allergens' => [], 'groups' => ['Size', 'Milk choice']],
                    ['name' => 'Hummus Veggie Box', 'slug' => 'hummus-veggie-box', 'description' => 'House hummus, crisp vegetables and seeded crackers.', 'price' => 6.00, 'minutes' => 7, 'station' => 'packaging', 'allergens' => ['sesame'], 'groups' => ['Spice level']],
                    ['name' => 'Overnight Oats', 'slug' => 'overnight-oats', 'description' => 'Rolled oats, berries, chia and maple.', 'price' => 5.25, 'minutes' => 3, 'station' => 'packaging', 'allergens' => ['gluten'], 'groups' => ['Milk choice', 'Protein add-on']],
                ],
            ],
            [
                'name' => 'Bujtina Te Ura', 'slug' => 'bujtina-te-ura', 'type' => 'traditional_restaurant', 'category' => 'Traditional plates',
                'branches' => [['name' => 'Bujtina Te Ura Center', 'city' => 'Lipjan', 'address' => 'Sheshi Adem Jashari 6', 'phone' => '+383 44 666 777', 'pickup_instructions' => 'Te hyrja kryesore e restorantit tradicional, paraqitni kodin te përgjegjësi.']],
                'products' => [
                    ['name' => 'Flija', 'slug' => 'flija', 'description' => 'Layered traditional pastry served with yogurt.', 'price' => 7.50, 'minutes' => 18, 'station' => 'oven', 'allergens' => ['gluten', 'dairy'], 'groups' => []],
                    ['name' => 'Tavë Kosi', 'slug' => 'tave-kosi', 'description' => 'Baked lamb and rice with a tangy yogurt crust.', 'price' => 9.00, 'minutes' => 22, 'station' => 'oven', 'allergens' => ['dairy', 'eggs'], 'groups' => ['Spice level']],
                    ['name' => 'Stuffed Peppers', 'slug' => 'stuffed-peppers', 'description' => 'Slow-cooked peppers filled with rice and herbs.', 'price' => 6.50, 'minutes' => 16, 'station' => 'grill', 'allergens' => [], 'groups' => ['Spice level']],
                ],
            ],
            [
                'name' => 'Sweet Atelier', 'slug' => 'sweet-atelier', 'type' => 'sweet_shop', 'category' => 'Desserts',
                'branches' => [['name' => 'Sweet Atelier Center', 'city' => 'Lipjan', 'address' => 'Rruga e Pavarësisë 14', 'phone' => '+383 44 777 888', 'pickup_instructions' => 'Paraqitni kodin te banaku i ëmbëlsirave për paketimin e porosisë.']],
                'products' => [
                    ['name' => 'Pistachio Baklava', 'slug' => 'pistachio-baklava', 'description' => 'Crisp filo pastry with pistachio and light syrup.', 'price' => 3.00, 'minutes' => 4, 'station' => 'packaging', 'allergens' => ['gluten', 'dairy', 'nuts'], 'groups' => []],
                    ['name' => 'Vanilla Cheesecake', 'slug' => 'vanilla-cheesecake', 'description' => 'Creamy baked cheesecake on a biscuit base.', 'price' => 4.50, 'minutes' => 3, 'station' => 'packaging', 'allergens' => ['gluten', 'dairy', 'eggs'], 'groups' => []],
                    ['name' => 'Fruit Tart', 'slug' => 'fruit-tart', 'description' => 'Seasonal fruit, vanilla cream and shortcrust pastry.', 'price' => 3.75, 'minutes' => 4, 'station' => 'packaging', 'allergens' => ['gluten', 'dairy', 'eggs'], 'groups' => []],
                ],
            ],
        ];

        foreach ($businesses as $business) {
            $restaurant = Restaurant::updateOrCreate(
                ['slug' => $business['slug']],
                [
                    'owner_id' => match ($business['slug']) {
                        'casa-forno' => $demoUsers[User::ROLE_MANAGER]->id ?? null,
                        'urban-grill' => $demoUsers['manager.urban@foodora.demo']->id ?? null,
                        default => null,
                    },
                    'name' => $business['name'],
                    'business_type' => $business['type'],
                    'description' => $business['category'].' and local favorites, freshly prepared for pickup.',
                    'status' => 'approved',
                ],
            );

            $category = ProductCategory::updateOrCreate(
                ['restaurant_id' => $restaurant->id, 'slug' => str($business['category'])->slug()],
                ['name' => $business['category'], 'sort_order' => 1, 'is_active' => true],
            );

            $branches = [];
            foreach ($business['branches'] as $branchData) {
                $branch = Branch::updateOrCreate(
                    ['restaurant_id' => $restaurant->id, 'name' => $branchData['name']],
                    [...$branchData, 'timezone' => 'Europe/Pristina', 'is_active' => true],
                );
                $branches[] = $branch;

                for ($weekday = 0; $weekday < 7; $weekday++) {
                    $isClosed = ($branchData['name'] === 'Sweet Atelier Center' && $weekday === 1);
                    BusinessHour::updateOrCreate(
                        ['branch_id' => $branch->id, 'weekday' => $weekday],
                        ['opens_at' => '09:00', 'closes_at' => '22:00', 'slot_interval_minutes' => 15, 'orders_per_slot' => 8, 'is_closed' => $isClosed],
                    );
                }
            }

            if ($restaurant->slug === 'casa-forno' && isset($demoUsers[User::ROLE_MANAGER])) {
                foreach ($branches as $branch) {
                    $branch->staff()->syncWithoutDetaching([$demoUsers[User::ROLE_MANAGER]->id => ['role' => User::ROLE_MANAGER]]);
                }
                $branches[0]->staff()->syncWithoutDetaching([$demoUsers[User::ROLE_KITCHEN]->id => ['role' => User::ROLE_KITCHEN]]);
                $branches[1]->staff()->syncWithoutDetaching([$demoUsers[User::ROLE_PICKUP]->id => ['role' => User::ROLE_PICKUP]]);
            }
            if ($restaurant->slug === 'urban-grill' && isset($demoUsers['manager.urban@foodora.demo'])) {
                $branch = $branches[0];
                $branch->staff()->syncWithoutDetaching([$demoUsers['manager.urban@foodora.demo']->id => ['role' => User::ROLE_MANAGER]]);
                $branch->staff()->syncWithoutDetaching([$demoUsers['kitchen.urban@foodora.demo']->id => ['role' => User::ROLE_KITCHEN]]);
                $branch->staff()->syncWithoutDetaching([$demoUsers['pickup.urban@foodora.demo']->id => ['role' => User::ROLE_PICKUP]]);
            }

            foreach ($business['products'] as $index => $item) {
                $product = Product::updateOrCreate(
                    ['restaurant_id' => $restaurant->id, 'slug' => $item['slug']],
                    [
                        'category_id' => $category->id,
                        'name' => $item['name'],
                        'description' => $item['description'],
                        'allergens' => $item['allergens'] ?? null,
                        'price' => $item['price'],
                        'prep_minutes' => $item['minutes'],
                        'prep_station' => $item['station'],
                        'sort_order' => $index + 1,
                        'is_available' => true,
                    ],
                );

                $product->optionGroups()->sync(collect($item['groups'])
                    ->map(fn (string $groupName) => $optionGroups[$groupName]->id)
                    ->all());

                foreach ($branches as $branch) {
                    $isAvailable = ! ($branch->name === 'Casa Forno East' && $item['slug'] === 'four-cheese-pizza');
                    $branch->products()->syncWithoutDetaching([$product->id => ['is_available' => $isAvailable, 'price_override' => null]]);
                }
            }
        }
    }

    private function seedDemoOrders(array $demoUsers): void
    {
        $states = [
            'pending_confirmation', 'pending_confirmation', 'confirmed', 'confirmed', 'preparing', 'preparing',
            'ready', 'ready', 'picked_up', 'picked_up', 'picked_up', 'picked_up', 'cancelled', 'cancelled', 'rejected',
        ];
        $branches = Branch::query()->whereIn('name', ['Casa Forno Center', 'Casa Forno East', 'Urban Grill Center'])
            ->with(['products.optionGroups.options'])->orderBy('id')->get()->values();
        $customers = [$demoUsers[User::ROLE_CUSTOMER], $demoUsers['customer2@example.com']];

        foreach ($states as $index => $status) {
            $branch = $branches[$index % $branches->count()];
            $customer = $customers[$index % count($customers)];
            $pickupAt = in_array($status, ['picked_up'], true)
                ? now()->subDay()->setTime(13, 0)->addMinutes(($index % 4) * 15)
                : now()->addDay()->setTime(12, 0)->addMinutes(($index % 4) * 15);
            $token = Str::random(40);
            $order = Order::updateOrCreate(
                ['customer_id' => $customer->id, 'idempotency_key' => 'demo-order-'.str_pad((string) ($index + 1), 3, '0', STR_PAD_LEFT)],
                [
                    'branch_id' => $branch->id,
                    'status' => $status,
                    'schedule_type' => $index % 3 === 0 ? 'scheduled' : 'asap',
                    'pickup_at' => $pickupAt->utc(),
                    'payment_method' => 'cash_at_pickup',
                    'payment_status' => $status === 'picked_up' ? 'paid' : 'unpaid',
                    'subtotal' => 0,
                    'total' => 0,
                    'request_fingerprint' => hash('sha256', 'foodora-demo-order-'.$index),
                    'pickup_code_hash' => hash('sha256', $token),
                    'pickup_token_encrypted' => Crypt::encryptString($token),
                    'pickup_code_used_at' => $status === 'picked_up' ? now()->subDay() : null,
                    'eta_minutes' => $status === 'picked_up' ? 0 : 15 + ($index % 20),
                    'estimated_ready_at' => $status === 'pending_confirmation' ? null : $pickupAt->utc(),
                    'packaging_confirmed_at' => in_array($status, ['ready', 'picked_up'], true) ? now()->subMinutes(10) : null,
                    'customer_note' => $index % 5 === 0 ? 'Demo note: please include napkins.' : null,
                ],
            );

            $product = $branch->products->sortBy('id')->values()[$index % max(1, $branch->products->count())];
            $product->loadMissing('optionGroups.options');
            $selectedOptions = collect();
            foreach ($product->optionGroups as $group) {
                $minimum = $group->is_required ? max(1, $group->min_selections) : 0;
                if ($minimum > 0) {
                    $selectedOptions = $selectedOptions->merge($group->options->where('is_available', true)->take($minimum));
                }
            }
            $unitPrice = (float) ($product->pivot->price_override ?? $product->price)
                + $selectedOptions->sum(fn ($option) => (float) $option->price_delta);
            $quantity = 1 + ($index % 2);
            $item = $order->items()->updateOrCreate(
                ['product_id' => $product->id],
                [
                    'product_name' => $product->name,
                    'unit_price' => $unitPrice,
                    'quantity' => $quantity,
                    'line_total' => $unitPrice * $quantity,
                    'prep_station' => $product->prep_station,
                    'prep_status' => in_array($status, ['ready', 'picked_up'], true) ? 'completed' : ($status === 'preparing' ? 'preparing' : 'pending'),
                    'completed_at' => in_array($status, ['ready', 'picked_up'], true) ? now()->subMinutes(12) : null,
                    'prep_minutes' => $product->prep_minutes,
                ],
            );
            foreach ($selectedOptions as $option) {
                $item->options()->updateOrCreate(
                    ['product_option_id' => $option->id],
                    ['group_name' => $option->group->name, 'option_name' => $option->name, 'price_delta' => $option->price_delta],
                );
            }
            $total = $unitPrice * $quantity;
            $order->update(['subtotal' => $total, 'total' => $total]);
            if ($status === 'picked_up') {
                $recorder = $branch->staff()->wherePivot('role', User::ROLE_PICKUP)->first()
                    ?? $branch->staff()->wherePivot('role', User::ROLE_MANAGER)->first();
                $order->payment()->updateOrCreate([], [
                    'recorded_by' => $recorder?->id ?? $demoUsers[User::ROLE_ADMIN]->id,
                    'method' => 'cash_at_pickup',
                    'status' => 'paid',
                    'amount' => $total,
                    'paid_at' => now()->subDay(),
                ]);
            }

            $path = match ($status) {
                'pending_confirmation' => ['pending_confirmation'],
                'confirmed' => ['pending_confirmation', 'confirmed'],
                'preparing' => ['pending_confirmation', 'confirmed', 'preparing'],
                'ready' => ['pending_confirmation', 'confirmed', 'preparing', 'ready'],
                'picked_up' => ['pending_confirmation', 'confirmed', 'preparing', 'ready', 'picked_up'],
                'cancelled' => ['pending_confirmation', 'cancelled'],
                'rejected' => ['pending_confirmation', 'rejected'],
            };
            $previous = null;
            foreach ($path as $next) {
                if (! $order->statusHistory()->where('to_status', $next)->exists()) {
                    $order->statusHistory()->create(['actor_id' => $customer->id, 'from_status' => $previous, 'to_status' => $next, 'note' => 'Seeded demonstration order.']);
                }
                $previous = $next;
            }
            if (! $order->etaHistory()->exists()) {
                $order->etaHistory()->create(['actor_id' => $customer->id, 'eta_minutes' => $order->eta_minutes, 'reason' => 'Demo order estimate']);
            }
        }
    }
}
