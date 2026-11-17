<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\ProductCategory;
use App\Models\Branch;
use App\Models\Restaurant;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Support\Str;

class AdminController extends Controller
{
    public function branches(Request $request): JsonResponse
    {
        abort_unless($request->user()->isAdministrator(), 403);

        return response()->json(['data' => Branch::query()->with('restaurant:id,name')->orderBy('restaurant_id')->orderBy('name')->get()]);
    }

    public function staffAccounts(Request $request): JsonResponse
    {
        abort_unless($request->user()->isAdministrator(), 403);

        return response()->json(['data' => User::query()->where('is_active', true)->whereIn('role', [User::ROLE_CUSTOMER, ...User::STAFF_ROLES])->orderBy('name')->get(['id', 'name', 'email', 'role'])]);
    }

    public function users(Request $request): JsonResponse
    {
        abort_unless($request->user()->isAdministrator(), 403);

        $users = User::query()
            ->when($request->query('search'), fn ($query, $search) => $query->where(fn ($query) => $query->where('name', 'like', '%'.$search.'%')->orWhere('email', 'like', '%'.$search.'%')))
            ->orderBy('name')->paginate(30, ['id', 'name', 'email', 'role', 'is_active']);

        return response()->json($users);
    }

    public function setUserStatus(Request $request, User $user): JsonResponse
    {
        abort_unless($request->user()->isAdministrator(), 403);
        $data = $request->validate(['is_active' => ['required', 'boolean']]);
        abort_if($request->user()->id === $user->id && ! $data['is_active'], 422, 'You cannot deactivate your own account.');
        if ($user->isAdministrator() && ! $data['is_active']) {
            abort_if(User::query()->where('role', User::ROLE_ADMIN)->where('is_active', true)->count() <= 1, 422, 'The last active administrator cannot be deactivated.');
        }

        $previous = $user->is_active;
        $user->update(['is_active' => $data['is_active']]);
        $this->audit($request, 'user.status_changed', $user, ['from' => $previous, 'to' => $user->is_active]);

        return response()->json(['data' => $user->fresh(['staffBranches'])->only(['id', 'name', 'email', 'role', 'is_active'])]);
    }

    public function branchStaff(Request $request, Branch $branch): JsonResponse
    {
        abort_unless($request->user()->isAdministrator(), 403);

        return response()->json(['data' => $branch->staff()->orderBy('name')->get(['users.id', 'users.name', 'users.email', 'users.role'])
            ->map(fn (User $user) => [...$user->toArray(), 'branch_role' => $user->pivot->role])]);
    }

    public function assignStaff(Request $request, Branch $branch): JsonResponse
    {
        abort_unless($request->user()->isAdministrator(), 403);
        $data = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'role' => ['required', Rule::in(User::STAFF_ROLES)],
        ]);
        $user = User::findOrFail($data['user_id']);
        abort_if($user->isAdministrator(), 422, 'Administrator accounts cannot be assigned as branch staff.');
        abort_if(in_array($user->role, User::STAFF_ROLES, true) && $user->role !== $data['role'], 422, 'Remove this account from its current branches before changing its staff role.');

        DB::transaction(function () use ($request, $branch, $user, $data): void {
            $branchIds = $user->staffBranches()->pluck('branches.id')->map(fn ($id) => (int) $id)->all();
            $branchIds[] = $branch->id;
            $user->update(['role' => $data['role']]);
            $user->staffBranches()->syncWithPivotValues(array_unique($branchIds), ['role' => $data['role']]);
            $this->audit($request, 'staff.assigned', $user, ['branch_id' => $branch->id, 'role' => $data['role']]);
        });

        return response()->json(['data' => $user->fresh(['staffBranches'])->only(['id', 'name', 'email', 'role'])], 200);
    }

    public function removeStaff(Request $request, Branch $branch, User $user): JsonResponse
    {
        abort_unless($request->user()->isAdministrator(), 403);
        abort_unless($branch->staff()->whereKey($user->id)->exists(), 404);

        DB::transaction(function () use ($request, $branch, $user): void {
            $branch->staff()->detach($user->id);
            if (in_array($user->role, User::STAFF_ROLES, true) && ! $user->staffBranches()->exists()) {
                $user->update(['role' => User::ROLE_CUSTOMER]);
            }
            $this->audit($request, 'staff.removed', $user, ['branch_id' => $branch->id]);
        });

        return response()->json(['message' => 'Staff assignment removed.']);
    }

    public function restaurants(Request $request): JsonResponse
    {
        abort_unless($request->user()->isAdministrator(), 403);

        $restaurants = Restaurant::query()
            ->withCount(['branches', 'products'])
            ->when($request->query('status'), fn ($query, $status) => $query->where('status', $status))
            ->orderBy('status')->orderBy('name')->paginate(20);

        return response()->json($restaurants);
    }

    public function setRestaurantStatus(Request $request, Restaurant $restaurant): JsonResponse
    {
        abort_unless($request->user()->isAdministrator(), 403);
        $data = $request->validate(['status' => ['required', Rule::in(['approved', 'rejected', 'suspended'])]]);
        $previous = $restaurant->status;
        $restaurant->update(['status' => $data['status']]);

        $this->audit($request, 'restaurant.status_changed', $restaurant, ['from' => $previous, 'to' => $restaurant->status]);

        return response()->json(['data' => $restaurant->fresh()->loadCount(['branches', 'products'])]);
    }

    public function categories(Request $request, Restaurant $restaurant): JsonResponse
    {
        abort_unless($request->user()->isAdministrator(), 403);

        return response()->json(['data' => $restaurant->categories()->orderBy('sort_order')->orderBy('name')->get()]);
    }

    public function createCategory(Request $request, Restaurant $restaurant): JsonResponse
    {
        abort_unless($request->user()->isAdministrator(), 403);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'slug' => ['nullable', 'string', 'max:120', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/'],
            'sort_order' => ['sometimes', 'integer', 'min:0', 'max:65535'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        $slug = $data['slug'] ?? Str::slug($data['name']);
        validator(['slug' => $slug], ['slug' => ['required', 'max:120', Rule::unique('product_categories')->where('restaurant_id', $restaurant->id)]])->validate();

        $category = $restaurant->categories()->create([...$data, 'slug' => $slug]);
        $this->audit($request, 'category.created', $category, ['restaurant_id' => $restaurant->id, 'name' => $category->name]);

        return response()->json(['data' => $category], 201);
    }

    public function updateCategory(Request $request, Restaurant $restaurant, ProductCategory $category): JsonResponse
    {
        abort_unless($request->user()->isAdministrator(), 403);
        abort_unless($category->restaurant_id === $restaurant->id, 404);

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:100'],
            'slug' => ['sometimes', 'required', 'string', 'max:120', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', Rule::unique('product_categories')->where('restaurant_id', $restaurant->id)->ignore($category->id)],
            'sort_order' => ['sometimes', 'integer', 'min:0', 'max:65535'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        $category->update($data);
        $this->audit($request, 'category.updated', $category, $data);

        return response()->json(['data' => $category->fresh()]);
    }

    private function audit(Request $request, string $event, object $subject, array $metadata): void
    {
        AuditLog::create([
            'actor_id' => $request->user()->id,
            'event' => $event,
            'subject_type' => class_basename($subject),
            'subject_id' => $subject->id,
            'metadata' => $metadata,
            'ip_address' => $request->ip(),
            'created_at' => now(),
        ]);
    }
}
