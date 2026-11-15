<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\BusinessHour;
use App\Models\Order;
use App\Models\OptionGroup;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ManagerController extends Controller
{
    public function branches(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === User::ROLE_MANAGER, 403);
        return response()->json(['data' => $request->user()->staffBranches()
            ->wherePivot('role', User::ROLE_MANAGER)->with(['restaurant', 'businessHours'])
            ->orderBy('branches.name')->get()]);
    }

    public function staff(Request $request, Branch $branch): JsonResponse
    {
        $this->authorizeBranch($request, $branch);

        return response()->json(['data' => $branch->staff()->wherePivotIn('role', [User::ROLE_KITCHEN, User::ROLE_PICKUP])
            ->orderBy('name')->get(['users.id', 'users.name', 'users.email', 'users.role'])
            ->map(fn (User $user) => [...$user->toArray(), 'branch_role' => $user->pivot->role])]);
    }

    public function assignStaff(Request $request, Branch $branch): JsonResponse
    {
        $this->authorizeBranch($request, $branch);
        $data = $request->validate([
            'email' => ['required', 'email', 'exists:users,email'],
            'role' => ['required', Rule::in([User::ROLE_KITCHEN, User::ROLE_PICKUP])],
        ]);
        $user = User::where('email', $data['email'])->firstOrFail();
        abort_if(in_array($user->role, [User::ROLE_MANAGER, User::ROLE_ADMIN], true), 422, 'Managers and administrators cannot be assigned as kitchen or pickup staff.');
        abort_if(in_array($user->role, User::STAFF_ROLES, true) && $user->role !== $data['role'], 422, 'Ask an administrator to remove the account’s current staff assignments before changing its role.');

        DB::transaction(function () use ($request, $branch, $user, $data): void {
            $user->update(['role' => $data['role']]);
            $branch->staff()->syncWithoutDetaching([$user->id => ['role' => $data['role']]]);
            $this->audit($request, 'manager.staff_assigned', $user, ['branch_id' => $branch->id, 'role' => $data['role']]);
        });

        return response()->json(['data' => $user->fresh()]);
    }

    public function removeStaff(Request $request, Branch $branch, User $user): JsonResponse
    {
        $this->authorizeBranch($request, $branch);
        abort_unless($branch->staff()->whereKey($user->id)->wherePivotIn('role', [User::ROLE_KITCHEN, User::ROLE_PICKUP])->exists(), 404);

        DB::transaction(function () use ($request, $branch, $user): void {
            $branch->staff()->detach($user->id);
            if (in_array($user->role, [User::ROLE_KITCHEN, User::ROLE_PICKUP], true) && ! $user->staffBranches()->exists()) {
                $user->update(['role' => User::ROLE_CUSTOMER]);
            }
            $this->audit($request, 'manager.staff_removed', $user, ['branch_id' => $branch->id]);
        });

        return response()->json(['message' => 'Staff assignment removed.']);
    }

    public function products(Request $request, Branch $branch): JsonResponse
    {
        $this->authorizeBranch($request, $branch);
        $products = $branch->products()->with(['category', 'optionGroups.options'])
            ->orderBy('products.name')->get();
        return response()->json(['data' => $products, 'categories' => ProductCategory::where('restaurant_id', $branch->restaurant_id)->where('is_active', true)->orderBy('sort_order')->orderBy('name')->get()]);
    }

    public function createCategory(Request $request, Branch $branch): JsonResponse
    {
        $this->authorizeBranch($request, $branch);
        $this->assertManagerOwnsRestaurant($request, $branch);
        $data = $request->validate(['name' => ['required', 'string', 'max:100']]);
        $slug = Str::slug($data['name']);
        if (ProductCategory::where('restaurant_id', $branch->restaurant_id)->where('slug', $slug)->exists()) {
            throw ValidationException::withMessages(['name' => ['A category with this name already exists.']]);
        }
        $category = ProductCategory::create(['restaurant_id' => $branch->restaurant_id, 'name' => $data['name'], 'slug' => $slug, 'sort_order' => (int) ProductCategory::where('restaurant_id', $branch->restaurant_id)->max('sort_order') + 1, 'is_active' => true]);
        $this->audit($request, 'manager.category_created', $category, ['branch_id' => $branch->id]);
        return response()->json(['data' => $category], 201);
    }

    public function createProduct(Request $request, Branch $branch): JsonResponse
    {
        $this->authorizeBranch($request, $branch);
        $data = $request->validate([
            'category_id' => ['required', 'integer', Rule::exists('product_categories', 'id')->where('restaurant_id', $branch->restaurant_id)],
            'name' => ['required', 'string', 'max:160'],
            'description' => ['nullable', 'string', 'max:2000'],
            'image_path' => ['nullable', 'url', 'max:2048'],
            'allergens' => ['sometimes', 'array', 'max:30'],
            'allergens.*' => ['string', 'max:80'],
            'price' => ['required', 'numeric', 'min:0', 'max:999999.99'],
            'prep_minutes' => ['sometimes', 'integer', 'min:1', 'max:300'],
            'prep_station' => ['sometimes', 'in:pizza,grill,oven,drinks,packaging'],
            'option_group_ids' => ['sometimes', 'array', 'max:20'],
            'option_group_ids.*' => ['integer', 'distinct', 'exists:option_groups,id'],
        ]);
        $this->validateOptionGroups($data['option_group_ids'] ?? [], $branch);
        $this->assertManagerOwnsRestaurant($request, $branch);

        $product = DB::transaction(function () use ($request, $branch, $data): Product {
            $slug = Str::slug($data['name']).'-'.Str::lower(Str::random(6));
            $product = Product::create([
                'restaurant_id' => $branch->restaurant_id,
                'category_id' => $data['category_id'],
                'name' => $data['name'],
                'slug' => $slug,
                'description' => $data['description'] ?? null,
                'image_path' => $data['image_path'] ?? null,
                'allergens' => $data['allergens'] ?? null,
                'price' => $data['price'],
                'prep_minutes' => $data['prep_minutes'] ?? 15,
                'prep_station' => $data['prep_station'] ?? 'packaging',
                'is_available' => true,
            ]);
            $product->optionGroups()->sync($data['option_group_ids'] ?? []);
            $branch->products()->attach($product->id, ['is_available' => true, 'price_override' => null]);
            $this->audit($request, 'manager.product_created', $product, ['branch_id' => $branch->id]);
            return $product->load(['category', 'optionGroups.options']);
        });

        return response()->json(['data' => $product], 201);
    }

    public function updateProduct(Request $request, Branch $branch, Product $product): JsonResponse
    {
        $this->authorizeBranch($request, $branch);
        abort_unless($product->restaurant_id === $branch->restaurant_id, 404);
        $data = $request->validate([
            'category_id' => ['sometimes', 'integer', Rule::exists('product_categories', 'id')->where('restaurant_id', $branch->restaurant_id)],
            'name' => ['sometimes', 'string', 'max:160'],
            'description' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'image_path' => ['sometimes', 'nullable', 'url', 'max:2048'],
            'allergens' => ['sometimes', 'nullable', 'array', 'max:30'],
            'allergens.*' => ['string', 'max:80'],
            'price' => ['sometimes', 'numeric', 'min:0', 'max:999999.99'],
            'prep_minutes' => ['sometimes', 'integer', 'min:1', 'max:300'],
            'prep_station' => ['sometimes', 'in:pizza,grill,oven,drinks,packaging'],
            'option_group_ids' => ['sometimes', 'array', 'max:20'],
            'option_group_ids.*' => ['integer', 'distinct', 'exists:option_groups,id'],
            'branch_available' => ['sometimes', 'boolean'],
            'branch_price' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:999999.99'],
        ]);
        $this->validateOptionGroups($data['option_group_ids'] ?? [], $branch);
        $globalFields = ['category_id', 'name', 'description', 'image_path', 'allergens', 'price', 'prep_minutes', 'prep_station', 'option_group_ids'];
        if (array_intersect($globalFields, array_keys($data))) $this->assertManagerOwnsRestaurant($request, $branch);

        $updated = DB::transaction(function () use ($request, $branch, $product, $data, $globalFields): Product {
            $globalData = array_intersect_key($data, array_flip($globalFields));
            $groups = $globalData['option_group_ids'] ?? null;
            unset($globalData['option_group_ids']);
            if ($globalData) $product->update($globalData);
            if ($groups !== null) $product->optionGroups()->sync($groups);
            $pivot = $branch->products()->whereKey($product->id)->exists()
                ? $branch->products()->whereKey($product->id)->firstOrFail()->pivot
                : null;
            $branch->products()->syncWithoutDetaching([$product->id => [
                'is_available' => $data['branch_available'] ?? $pivot?->is_available ?? true,
                'price_override' => array_key_exists('branch_price', $data) ? $data['branch_price'] : $pivot?->price_override,
            ]]);
            $this->audit($request, 'manager.product_updated', $product, ['branch_id' => $branch->id, 'changed_fields' => array_keys($data)]);
            return $product->fresh()->load(['category', 'optionGroups.options']);
        });
        return response()->json(['data' => $updated]);
    }

    public function hours(Request $request, Branch $branch): JsonResponse
    {
        $this->authorizeBranch($request, $branch);
        return response()->json(['data' => $branch->businessHours()->orderBy('weekday')->get()]);
    }

    public function updateHours(Request $request, Branch $branch): JsonResponse
    {
        $this->authorizeBranch($request, $branch);
        $data = $request->validate([
            'hours' => ['required', 'array', 'size:7'],
            'hours.*.weekday' => ['required', 'integer', 'between:0,6', 'distinct'],
            'hours.*.is_closed' => ['required', 'boolean'],
            'hours.*.opens_at' => ['nullable', 'date_format:H:i'],
            'hours.*.closes_at' => ['nullable', 'date_format:H:i'],
            'hours.*.slot_interval_minutes' => ['required', 'integer', 'between:5,120'],
            'hours.*.orders_per_slot' => ['required', 'integer', 'between:1,500'],
        ]);
        foreach ($data['hours'] as $day) {
            if (! $day['is_closed'] && (! ($day['opens_at'] ?? null) || ! ($day['closes_at'] ?? null) || $day['opens_at'] >= $day['closes_at'])) {
                throw ValidationException::withMessages(['hours' => ['Open days need valid opening and closing times on the same day.']]);
            }
        }
        DB::transaction(function () use ($data, $branch, $request): void {
            foreach ($data['hours'] as $day) {
                $hours = BusinessHour::updateOrCreate(
                    ['branch_id' => $branch->id, 'weekday' => $day['weekday']],
                    ['is_closed' => $day['is_closed'], 'opens_at' => $day['opens_at'] ?? null, 'closes_at' => $day['closes_at'] ?? null,
                        'slot_interval_minutes' => $day['slot_interval_minutes'], 'orders_per_slot' => $day['orders_per_slot']],
                );
                $this->audit($request, 'manager.business_hours_updated', $hours, ['branch_id' => $branch->id, 'weekday' => $day['weekday']]);
            }
        });
        return response()->json(['data' => $branch->businessHours()->orderBy('weekday')->get()]);
    }

    public function report(Request $request, Branch $branch): JsonResponse
    {
        $this->authorizeBranch($request, $branch);
        $filters = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);
        $orders = Order::query()->where('branch_id', $branch->id)
            ->when($filters['from'] ?? null, fn (Builder $query, string $from) => $query->whereDate('created_at', '>=', $from))
            ->when($filters['to'] ?? null, fn (Builder $query, string $to) => $query->whereDate('created_at', '<=', $to))
            ->with(['items', 'statusHistory'])->get();
        $paidRevenue = \App\Models\Payment::query()->whereIn('order_id', $orders->pluck('id'))->where('status', 'paid')->sum('amount');
        $completedOrders = $orders->where('status', 'picked_up');
        $bestsellers = $completedOrders->flatMap->items->groupBy('product_name')->map(fn ($items, $name) => [
            'product_name' => $name, 'quantity' => $items->sum('quantity'), 'revenue' => round($items->sum('line_total'), 2),
        ])->sortByDesc('quantity')->take(10)->values();
        $readyDurations = $completedOrders->map(function (Order $order): ?int {
            $start = $order->statusHistory->firstWhere('to_status', 'preparing')
                ?? $order->statusHistory->firstWhere('to_status', 'confirmed')
                ?? $order->created_at;
            $ready = $order->statusHistory->firstWhere('to_status', 'ready');
            if (! $ready) return null;
            $startAt = $start instanceof \App\Models\OrderStatusHistory ? $start->created_at : $start;
            return (int) $startAt->diffInMinutes($ready->created_at);
        })->filter();
        $lateOrders = $orders->filter(function (Order $order): bool {
            $ready = $order->statusHistory->firstWhere('to_status', 'ready');
            return $ready && $order->estimated_ready_at && $ready->created_at->gt($order->estimated_ready_at);
        })->count();
        $cancelledOrRejected = $orders->whereIn('status', ['cancelled', 'rejected'])->count();

        return response()->json(['data' => [
            'orders_total' => $orders->count(),
            'orders_by_status' => $orders->groupBy('status')->map->count(),
            'paid_revenue' => number_format((float) $paidRevenue, 2, '.', ''),
            'completed_orders' => $completedOrders->count(),
            'average_preparation_minutes' => $readyDurations->isEmpty() ? null : round($readyDurations->avg(), 1),
            'late_orders' => $lateOrders,
            'cancelled_or_rejected' => $cancelledOrRejected,
            'bestsellers' => $bestsellers,
        ]]);
    }

    private function authorizeBranch(Request $request, Branch $branch): void
    {
        abort_unless($request->user()->hasBranchRole($branch->id, User::ROLE_MANAGER), 403);
    }

    private function assertManagerOwnsRestaurant(Request $request, Branch $branch): void
    {
        $allBranchIds = Branch::query()->where('restaurant_id', $branch->restaurant_id)->where('is_active', true)->pluck('id');
        $managedBranchIds = $request->user()->staffBranches()->wherePivot('role', User::ROLE_MANAGER)->whereIn('branches.id', $allBranchIds)->pluck('branches.id');
        abort_unless($allBranchIds->diff($managedBranchIds)->isEmpty(), 403, 'Restaurant-wide menu changes require manager access to every active branch.');
    }

    private function validateOptionGroups(array $ids, Branch $branch): void
    {
        if (! $ids) return;
        $count = OptionGroup::query()->whereIn('id', $ids)
            ->where(fn (Builder $query) => $query->whereNull('restaurant_id')->orWhere('restaurant_id', $branch->restaurant_id))->count();
        if ($count !== count($ids)) throw ValidationException::withMessages(['option_group_ids' => ['One or more option groups belong to a different restaurant.']]);
    }

    private function audit(Request $request, string $event, object $subject, array $metadata): void
    {
        AuditLog::create(['actor_id' => $request->user()->id, 'event' => $event, 'subject_type' => class_basename($subject),
            'subject_id' => $subject->id, 'metadata' => $metadata, 'ip_address' => $request->ip(), 'created_at' => CarbonImmutable::now()]);
    }
}
