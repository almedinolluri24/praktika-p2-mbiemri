<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\Order;
use App\Models\Restaurant;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PublicCatalogController extends Controller
{
    public function filters(): JsonResponse
    {
        $businessTypes = Restaurant::query()->where('status', 'approved')->distinct()->orderBy('business_type')->pluck('business_type')->all();
        $categories = \App\Models\ProductCategory::query()->where('is_active', true)
            ->whereHas('restaurant', fn ($query) => $query->where('status', 'approved'))
            ->whereHas('products', fn ($query) => $query->where('is_available', true))
            ->distinct()->orderBy('name')->pluck('name')->unique()->values()->all();
        $cities = Branch::query()->where('is_active', true)
            ->whereHas('restaurant', fn ($query) => $query->where('status', 'approved'))
            ->distinct()->orderBy('city')->pluck('city')->all();
        return response()->json(['business_types' => $businessTypes, 'categories' => $categories, 'cities' => $cities]);
    }

    public function restaurants(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'business_type' => ['nullable', Rule::in(Restaurant::BUSINESS_TYPES)],
            'city' => ['nullable', 'string', 'max:100'],
            'open_only' => ['nullable', 'boolean'],
            'sort' => ['nullable', Rule::in(['name', 'newest', 'business_type'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $restaurants = Restaurant::query()
            ->where('status', 'approved')
            ->whereHas('branches', fn ($query) => $query->where('is_active', true))
            ->with(['branches' => fn ($query) => $query->where('is_active', true)->with('businessHours')->orderBy('name')])
            ->withCount(['branches' => fn ($query) => $query->where('is_active', true)])
            ->when($filters['business_type'] ?? null, fn ($query, $type) => $query->where('business_type', $type))
            ->when($filters['city'] ?? null, fn ($query, $city) => $query->whereHas('branches', fn ($branches) => $branches->where('city', $city)->where('is_active', true)))
            ->when($filters['search'] ?? null, function ($query, $search): void {
                $query->where(function ($query) use ($search): void {
                    $query->where('name', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%")
                        ->orWhereHas('branches', fn ($branches) => $branches->where('city', 'like', "%{$search}%"));
                });
            });

        if ($request->boolean('open_only')) {
            $openBranchIds = Branch::query()->where('is_active', true)->with('businessHours')->get()
                ->filter(function (Branch $branch): bool {
                    $now = CarbonImmutable::now($branch->timezoneForCalculations());
                    $hours = $branch->businessHours->firstWhere('weekday', $now->dayOfWeek);
                    return $hours && ! $hours->is_closed && $hours->opens_at && $hours->closes_at
                        && $now->format('H:i:s') >= $hours->opens_at
                        && $now->format('H:i:s') < $hours->closes_at;
                })->pluck('id');
            $restaurants->whereHas('branches', fn ($branches) => $branches->whereIn('branches.id', $openBranchIds));
        }

        match ($filters['sort'] ?? 'name') {
            'newest' => $restaurants->latest('id'),
            'business_type' => $restaurants->orderBy('business_type')->orderBy('name'),
            default => $restaurants->orderBy('name'),
        };

        $page = $restaurants->paginate($filters['per_page'] ?? 12);
        $page->getCollection()->each(function (Restaurant $restaurant): void {
            $restaurant->branches->each(function (Branch $branch): void {
                $now = CarbonImmutable::now($branch->timezoneForCalculations());
                $hours = $branch->businessHours->firstWhere('weekday', $now->dayOfWeek);
                $isOpen = $hours && ! $hours->is_closed && $hours->opens_at && $hours->closes_at
                    && $now->format('H:i:s') >= $hours->opens_at
                    && $now->format('H:i:s') < $hours->closes_at;
                $branch->setAttribute('is_open_now', (bool) $isOpen);
            });
        });

        return response()->json($page);
    }

    public function branches(Restaurant $restaurant): JsonResponse
    {
        abort_unless($restaurant->status === 'approved', 404);

        return response()->json($restaurant->branches()->where('is_active', true)->with('businessHours')->orderBy('name')->get());
    }

    public function pickupSlots(Request $request, Branch $branch): JsonResponse
    {
        abort_unless($branch->is_active && $branch->restaurant()->where('status', 'approved')->exists(), 404);
        $data = $request->validate(['date' => ['required', 'date_format:Y-m-d', 'after_or_equal:today', 'before_or_equal:'.now()->addDays(14)->toDateString()]]);
        $timezone = $branch->timezoneForCalculations();
        $localDate = CarbonImmutable::parse($data['date'], $timezone);
        $hours = $branch->businessHours()->where('weekday', $localDate->dayOfWeek)->first();
        if (! $hours || $hours->is_closed || ! $hours->opens_at || ! $hours->closes_at) {
            return response()->json(['date' => $data['date'], 'timezone' => $branch->timezone, 'slots' => []]);
        }

        $start = CarbonImmutable::parse($data['date'].' '.$hours->opens_at, $timezone);
        $close = CarbonImmutable::parse($data['date'].' '.$hours->closes_at, $timezone);
        $interval = max(5, (int) $hours->slot_interval_minutes);
        $slots = [];
        for ($slot = $start; $slot->lt($close); $slot = $slot->addMinutes($interval)) {
            if ($slot->lte(CarbonImmutable::now($timezone)->addMinutes(10))) continue;
            $end = $slot->addMinutes($interval);
            $reserved = Order::query()->where('branch_id', $branch->id)
                ->whereIn('status', ['pending_confirmation', 'confirmed', 'preparing', 'ready'])
                ->where('pickup_at', '>=', $slot->utc())->where('pickup_at', '<', $end->utc())->count();
            if ($reserved < $hours->orders_per_slot) {
                $slots[] = ['pickup_at' => $slot->toIso8601String(), 'label' => $slot->format('H:i')];
            }
        }
        return response()->json(['date' => $data['date'], 'timezone' => $branch->timezone, 'slots' => $slots]);
    }

    public function products(Request $request, Branch $branch): JsonResponse
    {
        abort_unless($branch->is_active && $branch->restaurant()->where('status', 'approved')->exists(), 404);

        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'category_id' => ['nullable', 'integer'],
            'category' => ['nullable', 'string', 'max:80'],
            'sort' => ['nullable', Rule::in(['name', 'price_asc', 'price_desc', 'prep_time'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $products = $branch->products()
            ->wherePivot('is_available', true)
            ->where('products.is_available', true)
            ->with(['category', 'optionGroups.options' => fn ($query) => $query->where('is_available', true)->orderBy('sort_order')])
            ->when($filters['search'] ?? null, function ($query, $search): void {
                $query->where(function ($query) use ($search): void {
                    $query->where('products.name', 'like', "%{$search}%")
                        ->orWhere('products.description', 'like', "%{$search}%");
                });
            })
            ->when($filters['category_id'] ?? null, fn ($query, $categoryId) => $query->where('products.category_id', $categoryId));
        if ($filters['category'] ?? null) {
            $products->whereHas('category', fn ($query) => $query->where('name', $filters['category']));
        }

        match ($filters['sort'] ?? 'name') {
            'price_asc' => $products->orderByRaw('COALESCE(branch_products.price_override, products.price) asc'),
            'price_desc' => $products->orderByRaw('COALESCE(branch_products.price_override, products.price) desc'),
            'prep_time' => $products->orderBy('products.prep_minutes'),
            default => $products->orderBy('products.name'),
        };

        return response()->json($products->paginate($filters['per_page'] ?? 20));
    }
}
