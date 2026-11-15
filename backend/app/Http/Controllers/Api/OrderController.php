<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Events\OrderUpdated;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\BusinessHour;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderEtaHistory;
use App\Models\OrderStatusHistory;
use App\Models\Product;
use App\Models\ProductOption;
use App\Models\User;
use App\Notifications\OrderStatusNotification;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class OrderController extends Controller
{
    private const ACTIVE_STATUSES = ['pending_confirmation', 'confirmed', 'preparing', 'ready'];

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->role === User::ROLE_CUSTOMER || in_array($user->role, User::STAFF_ROLES, true) || $user->isAdministrator(), 403);
        $orders = Order::query()->with(['branch.restaurant', 'items.options'])
            ->when($user->role === User::ROLE_CUSTOMER, fn (Builder $query) => $query->where('customer_id', $user->id))
            ->when(in_array($user->role, User::STAFF_ROLES, true), fn (Builder $query) => $query->whereIn('branch_id', $user->staffBranches()->select('branches.id')))
            ->when($user->isAdministrator(), fn (Builder $query) => $query)
            ->latest()->paginate(20);

        return response()->json($orders);
    }

    public function kitchenQueue(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isAdministrator() || in_array($user->role, [User::ROLE_KITCHEN, User::ROLE_MANAGER], true), 403);
        $data = $request->validate(['station' => ['nullable', 'in:pizza,grill,oven,drinks,packaging']]);
        $branchIds = $user->staffBranches()
            ->wherePivotIn('role', [User::ROLE_KITCHEN, User::ROLE_MANAGER])
            ->select('branches.id');
        $orders = Order::query()->with(['branch.restaurant', 'items.options'])
            ->whereIn('status', ['confirmed', 'preparing'])
            ->when(! $user->isAdministrator(), fn (Builder $query) => $query->whereIn('branch_id', $branchIds))
            ->when($data['station'] ?? null, fn (Builder $query, string $station) => $query->whereHas('items', fn (Builder $items) => $items->where('prep_station', $station)))
            ->orderBy('pickup_at')->get();
        if (isset($data['station'])) {
            $orders->each(fn (Order $order) => $order->setRelation('items', $order->items->where('prep_station', $data['station'])->values()));
        }
        return response()->json(['data' => $orders]);
    }

    public function notifications(Request $request): JsonResponse
    {
        return response()->json($request->user()->notifications()->latest()->paginate(20));
    }

    public function markNotificationRead(Request $request, string $notification): JsonResponse
    {
        $record = $request->user()->notifications()->findOrFail($notification);
        $record->markAsRead();
        return response()->json(['message' => 'Notification marked as read.']);
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === User::ROLE_CUSTOMER, 403);
        $data = $request->validate([
            'branch_id' => ['required', 'integer', 'exists:branches,id'],
            'schedule_type' => ['sometimes', 'in:asap,scheduled'],
            'pickup_at' => ['required_if:schedule_type,scheduled', 'nullable', 'date', 'after:now'],
            'payment_method' => ['sometimes', 'in:cash_at_pickup'],
            'expected_total' => ['sometimes', 'numeric', 'min:0'],
            'customer_note' => ['nullable', 'string', 'max:1000'],
            'items' => ['required', 'array', 'min:1', 'max:30'],
            'items.*.product_id' => ['required', 'integer', 'distinct', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:20'],
            'items.*.options' => ['sometimes', 'array', 'max:10'],
            'items.*.options.*' => ['integer', 'distinct', 'exists:product_options,id'],
        ]);
        $idempotencyKey = (string) $request->header('Idempotency-Key', '');
        if ($idempotencyKey === '' || strlen($idempotencyKey) > 100) {
            throw ValidationException::withMessages(['Idempotency-Key' => ['A unique Idempotency-Key header of at most 100 characters is required.']]);
        }

        $fingerprintData = $data;
        $fingerprintData['items'] = collect($data['items'])->map(function (array $line): array {
            $options = array_map('intval', $line['options'] ?? []);
            sort($options);
            return ['product_id' => (int) $line['product_id'], 'quantity' => (int) $line['quantity'], 'options' => $options];
        })->sortBy('product_id')->values()->all();
        if (isset($data['expected_total'])) $fingerprintData['expected_total_cents'] = $this->cents($data['expected_total']);
        $fingerprint = hash('sha256', json_encode($fingerprintData, JSON_THROW_ON_ERROR));

        $customer = $request->user();
        $existing = Order::where('customer_id', $customer->id)->where('idempotency_key', $idempotencyKey)->first();
        if ($existing) {
            if (! hash_equals((string) $existing->request_fingerprint, $fingerprint)) {
                return response()->json(['message' => 'This Idempotency-Key was already used with a different request.'], 409);
            }
            return response()->json($this->orderPayload($existing, $this->decryptPickupToken($existing)), 200);
        }

        $branch = Branch::query()->whereKey($data['branch_id'])->where('is_active', true)->firstOrFail();
        $productIds = collect($data['items'])->pluck('product_id')->all();
        $products = Product::query()->with(['optionGroups.options'])
            ->whereIn('products.id', $productIds)
            ->where('products.restaurant_id', $branch->restaurant_id)
            ->where('products.is_available', true)
            ->whereHas('branches', fn (Builder $query) => $query->where('branches.id', $branch->id)->where('branch_products.is_available', true))
            ->get()->keyBy('id');
        if ($products->count() !== count($productIds)) {
            throw ValidationException::withMessages(['items' => ['One or more products are unavailable at this branch.']]);
        }

        $now = CarbonImmutable::now($branch->timezone);
        $scheduleType = $data['schedule_type'] ?? 'asap';
        $prepMinutes = collect($data['items'])->map(fn ($line) => (int) $products[$line['product_id']]->prep_minutes)->max() ?? 15;
        $requested = $scheduleType === 'scheduled'
            ? CarbonImmutable::parse($data['pickup_at'], $branch->timezone)
            : $now->addMinutes(max(10, $prepMinutes));

        $pickupCode = Str::random(40);
        try {
            $order = DB::transaction(function () use ($branch, $data, $customer, $idempotencyKey, $fingerprint, $scheduleType, $requested, $products, $pickupCode): Order|JsonResponse {
                $slot = $this->reserveSlot($branch, $requested, $scheduleType === 'asap');
                $pickupAt = $slot['pickup_at'];
                $subtotalCents = 0;
                $normalizedLines = [];

                foreach ($data['items'] as $line) {
                    /** @var Product $product */
                    $product = $products[$line['product_id']];
                    $optionIds = collect($line['options'] ?? [])->map(fn ($id) => (int) $id)->all();
                    $availableOptions = $product->optionGroups->flatMap->options->where('is_available', true)->keyBy('id');
                    if (count(array_diff($optionIds, $availableOptions->keys()->map(fn ($id) => (int) $id)->all())) > 0) {
                        throw ValidationException::withMessages(['items' => ["Invalid option selected for {$product->name}."]]);
                    }
                    foreach ($product->optionGroups as $group) {
                        $chosen = collect($optionIds)->filter(fn ($id) => (int) $availableOptions[$id]->option_group_id === $group->id);
                        $minimum = $group->is_required ? max(1, $group->min_selections) : $group->min_selections;
                        if ($chosen->count() < $minimum || $chosen->count() > $group->max_selections) {
                            throw ValidationException::withMessages(['items' => ["Choose a valid number of options for {$group->name}."]]);
                        }
                    }
                    $branchPrice = $product->branches()->whereKey($branch->id)->firstOrFail()->pivot->price_override;
                    $unitCents = $this->cents($branchPrice ?? $product->price);
                    $options = collect($optionIds)->map(fn ($id) => $availableOptions[$id]);
                    $unitCents += $options->sum(fn (ProductOption $option) => $this->cents($option->price_delta));
                    $quantity = (int) $line['quantity'];
                    $lineCents = $unitCents * $quantity;
                    $subtotalCents += $lineCents;
                    $normalizedLines[] = compact('product', 'options', 'quantity', 'unitCents', 'lineCents');
                }

                if (isset($data['expected_total']) && $this->cents($data['expected_total']) !== $subtotalCents) {
                    return response()->json([
                        'message' => 'The menu price changed. Review the updated total before confirming.',
                        'quote' => [
                            'subtotal' => number_format($subtotalCents / 100, 2, '.', ''),
                            'total' => number_format($subtotalCents / 100, 2, '.', ''),
                            'currency' => 'EUR',
                            'items' => array_map(fn (array $line) => [
                                'product_name' => $line['product']->name,
                                'quantity' => $line['quantity'],
                                'unit_price' => number_format($line['unitCents'] / 100, 2, '.', ''),
                                'line_total' => number_format($line['lineCents'] / 100, 2, '.', ''),
                                'options' => $line['options']->map(fn (ProductOption $option) => ['name' => $option->name, 'price_delta' => number_format((float) $option->price_delta, 2, '.', '')])->values(),
                            ], $normalizedLines),
                        ],
                    ], 409);
                }

                $order = Order::create([
                    'branch_id' => $branch->id,
                    'customer_id' => $customer->id,
                    'status' => 'pending_confirmation',
                    'schedule_type' => $scheduleType,
                    'pickup_at' => $pickupAt->utc(),
                    'payment_method' => 'cash_at_pickup',
                    'payment_status' => 'unpaid',
                    'subtotal' => $subtotalCents / 100,
                    'total' => $subtotalCents / 100,
                    'idempotency_key' => $idempotencyKey,
                    'request_fingerprint' => $fingerprint,
                    'pickup_code_hash' => hash('sha256', $pickupCode),
                    'pickup_token_encrypted' => Crypt::encryptString($pickupCode),
                    'eta_minutes' => null,
                    'customer_note' => $data['customer_note'] ?? null,
                ]);

                foreach ($normalizedLines as $line) {
                    /** @var Product $product */
                    $product = $line['product'];
                    $item = $order->items()->create([
                        'product_id' => $product->id,
                        'product_name' => $product->name,
                        'unit_price' => $line['unitCents'] / 100,
                        'quantity' => $line['quantity'],
                        'line_total' => $line['lineCents'] / 100,
                        'prep_station' => $product->prep_station,
                        'prep_minutes' => $product->prep_minutes,
                    ]);
                    foreach ($line['options'] as $option) {
                        $item->options()->create([
                            'product_option_id' => $option->id,
                            'group_name' => $option->group->name,
                            'option_name' => $option->name,
                            'price_delta' => $option->price_delta,
                        ]);
                    }
                }

                OrderStatusHistory::create(['order_id' => $order->id, 'actor_id' => $customer->id, 'from_status' => null, 'to_status' => 'pending_confirmation']);
                AuditLog::create([
                    'actor_id' => $customer->id,
                    'event' => 'order.created',
                    'subject_type' => 'order',
                    'subject_id' => $order->id,
                    'metadata' => ['branch_id' => $branch->id, 'total' => $order->total, 'schedule_type' => $scheduleType],
                    'ip_address' => request()->ip(),
                    'created_at' => now(),
                ]);

                return $order->load(['items.options', 'branch.restaurant']);
            }, 3);
        } catch (\Illuminate\Database\UniqueConstraintViolationException) {
            $order = Order::where('customer_id', $customer->id)->where('idempotency_key', $idempotencyKey)->firstOrFail();
            if (! hash_equals((string) $order->request_fingerprint, $fingerprint)) {
                return response()->json(['message' => 'This Idempotency-Key was already used with a different request.'], 409);
            }
            return response()->json($this->orderPayload($order, $this->decryptPickupToken($order)), 200);
        }

        if ($order instanceof JsonResponse) return $order;

        $customer->notify(new OrderStatusNotification($order));
        OrderUpdated::dispatch($order);
        return response()->json($this->orderPayload($order, $pickupCode), 201);
    }

    public function show(Request $request, Order $order): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isAdministrator() || $order->customer_id === $user->id || $user->hasBranchRole($order->branch_id, User::STAFF_ROLES), 404);
        $order->load(['branch.restaurant', 'items.options', 'statusHistory', 'etaHistory']);
        if ($order->customer_id === $user->id && $order->pickup_code_used_at === null) {
            $order->setAttribute('pickup_token', $this->decryptPickupToken($order));
        }
        return response()->json($order);
    }

    public function transition(Request $request, Order $order): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', 'in:confirmed,preparing,ready,cancelled,rejected'],
            'reason' => ['nullable', 'string', 'max:500'],
            'eta_minutes' => ['required_if:status,confirmed', 'nullable', 'integer', 'min:1', 'max:240'],
        ]);
        $actor = $request->user();
        $map = [
            'confirmed' => [User::ROLE_MANAGER],
            'preparing' => [User::ROLE_KITCHEN, User::ROLE_MANAGER],
            'ready' => [User::ROLE_KITCHEN, User::ROLE_MANAGER],
            'rejected' => [User::ROLE_MANAGER],
            'cancelled' => [User::ROLE_CUSTOMER, User::ROLE_MANAGER],
        ];
        $isCustomerCancellation = $data['status'] === 'cancelled'
            && $actor->role === User::ROLE_CUSTOMER
            && $order->customer_id === $actor->id
            && $order->status === 'pending_confirmation';
        abort_unless($actor->isAdministrator() || $isCustomerCancellation || $actor->hasBranchRole($order->branch_id, $map[$data['status']]), 403);
        if ($data['status'] === 'rejected' || ($data['status'] === 'cancelled' && $order->status !== 'pending_confirmation' && ! $isCustomerCancellation)) {
            if (trim((string) ($data['reason'] ?? '')) === '') {
                throw ValidationException::withMessages(['reason' => ['A reason is required for rejecting or cancelling an accepted order.']]);
            }
        }

        $allowed = [
            'pending_confirmation' => ['confirmed', 'rejected', 'cancelled'],
            'confirmed' => ['preparing', 'cancelled'],
            'preparing' => ['ready'],
            'ready' => [], 'picked_up' => [], 'cancelled' => [], 'rejected' => [],
        ];
        $updated = DB::transaction(function () use ($order, $data, $actor, $allowed, $request): Order {
            $locked = Order::query()->lockForUpdate()->findOrFail($order->id);
            $to = $data['status'];
            abort_unless(in_array($to, $allowed[$locked->status] ?? [], true), 409, 'This order status transition is not allowed.');
            if ($to === 'ready') {
                abort_unless($locked->items()->where('prep_status', '!=', 'completed')->doesntExist(), 409, 'Every order item must be completed before pickup is ready.');
                abort_unless($locked->packaging_confirmed_at !== null, 409, 'Packaging must be confirmed before the order is ready.');
            }
            $from = $locked->status;
            $locked->status = $to;
            if ($to === 'confirmed') {
                $locked->eta_minutes = (int) $data['eta_minutes'];
                $locked->estimated_ready_at = now($locked->branch->timezone)->addMinutes($locked->eta_minutes);
                OrderEtaHistory::create([
                    'order_id' => $locked->id,
                    'actor_id' => $actor->id,
                    'previous_eta_minutes' => null,
                    'eta_minutes' => $locked->eta_minutes,
                    'estimated_ready_at' => $locked->estimated_ready_at,
                    'reason' => 'Initial estimate set when the restaurant accepted the order.',
                ]);
            }
            $locked->save();
            OrderStatusHistory::create(['order_id' => $locked->id, 'actor_id' => $actor->id, 'from_status' => $from, 'to_status' => $to, 'note' => $data['reason'] ?? null]);
            AuditLog::create(['actor_id' => $actor->id, 'event' => 'order.status_changed', 'subject_type' => 'order', 'subject_id' => $locked->id, 'metadata' => ['from' => $from, 'to' => $to, 'reason' => $data['reason'] ?? null], 'ip_address' => $request->ip(), 'created_at' => now()]);
            return $locked->load(['branch.restaurant', 'items.options', 'statusHistory', 'etaHistory']);
        });
        $updated->customer->notify(new OrderStatusNotification($updated));
        OrderUpdated::dispatch($updated);
        return response()->json($updated);
    }

    public function updateEta(Request $request, Order $order): JsonResponse
    {
        $data = $request->validate(['eta_minutes' => ['required', 'integer', 'min:1', 'max:240'], 'reason' => ['required', 'string', 'min:3', 'max:500']]);
        $actor = $request->user();
        abort_unless($actor->isAdministrator() || $actor->hasBranchRole($order->branch_id, [User::ROLE_KITCHEN, User::ROLE_MANAGER]), 403);
        abort_unless(in_array($order->status, ['confirmed', 'preparing'], true), 409, 'ETA can only be adjusted before the order is ready.');

        $updated = DB::transaction(function () use ($order, $data, $actor, $request): Order {
            $locked = Order::query()->lockForUpdate()->findOrFail($order->id);
            abort_unless(in_array($locked->status, ['confirmed', 'preparing'], true), 409);
            $previousEta = $locked->eta_minutes;
            $locked->eta_minutes = $data['eta_minutes'];
            $locked->estimated_ready_at = now($locked->branch->timezone)->addMinutes($locked->eta_minutes);
            $locked->save();
            OrderEtaHistory::create(['order_id' => $locked->id, 'actor_id' => $actor->id, 'previous_eta_minutes' => $previousEta, 'eta_minutes' => $locked->eta_minutes, 'estimated_ready_at' => $locked->estimated_ready_at, 'reason' => $data['reason']]);
            AuditLog::create(['actor_id' => $actor->id, 'event' => 'order.eta_changed', 'subject_type' => 'order', 'subject_id' => $locked->id, 'metadata' => ['previous_eta_minutes' => $previousEta, 'eta_minutes' => $locked->eta_minutes, 'estimated_ready_at' => $locked->estimated_ready_at?->toIso8601String(), 'reason' => $data['reason']], 'ip_address' => $request->ip(), 'created_at' => now()]);
            return $locked->load(['branch.restaurant', 'items.options', 'etaHistory']);
        });
        $updated->customer->notify(new OrderStatusNotification($updated));
        OrderUpdated::dispatch($updated);
        return response()->json($updated);
    }

    public function completeItem(Request $request, Order $order, OrderItem $item): JsonResponse
    {
        abort_unless($item->order_id === $order->id, 404);
        $actor = $request->user();
        abort_unless($actor->isAdministrator() || $actor->hasBranchRole($order->branch_id, [User::ROLE_KITCHEN, User::ROLE_MANAGER]), 403);

        $updated = DB::transaction(function () use ($order, $item, $actor, $request): Order {
            $locked = Order::query()->lockForUpdate()->findOrFail($order->id);
            abort_unless($locked->status === 'preparing', 409, 'Items can only be completed while the order is being prepared.');
            $line = $locked->items()->lockForUpdate()->findOrFail($item->id);
            if ($line->prep_status !== 'completed') {
                $line->update(['prep_status' => 'completed', 'completed_at' => now()]);
                AuditLog::create(['actor_id' => $actor->id, 'event' => 'order.item_completed', 'subject_type' => 'order_item', 'subject_id' => $line->id, 'metadata' => ['order_id' => $locked->id, 'station' => $line->prep_station], 'ip_address' => $request->ip(), 'created_at' => now()]);
            }
            return $locked->load(['branch.restaurant', 'items.options']);
        });
        OrderUpdated::dispatch($updated);
        return response()->json($updated);
    }

    public function confirmPackaging(Request $request, Order $order): JsonResponse
    {
        $actor = $request->user();
        abort_unless($actor->isAdministrator() || $actor->hasBranchRole($order->branch_id, [User::ROLE_KITCHEN, User::ROLE_MANAGER]), 403);
        $updated = DB::transaction(function () use ($order, $actor, $request): Order {
            $locked = Order::query()->lockForUpdate()->findOrFail($order->id);
            abort_unless($locked->status === 'preparing', 409);
            abort_unless($locked->items()->where('prep_status', '!=', 'completed')->doesntExist(), 409, 'Every order item must be completed before packaging.');
            if ($locked->packaging_confirmed_at === null) {
                $locked->packaging_confirmed_at = now();
                $locked->save();
                AuditLog::create(['actor_id' => $actor->id, 'event' => 'order.packaging_confirmed', 'subject_type' => 'order', 'subject_id' => $locked->id, 'metadata' => [], 'ip_address' => $request->ip(), 'created_at' => now()]);
            }
            return $locked->load(['branch.restaurant', 'items.options']);
        });
        OrderUpdated::dispatch($updated);
        return response()->json($updated);
    }

    public function recordPayment(Request $request, Order $order): JsonResponse
    {
        $data = $request->validate(['amount' => ['required', 'numeric', 'min:0', 'max:99999999.99']]);
        $actor = $request->user();
        abort_unless($actor->isAdministrator() || $actor->hasBranchRole($order->branch_id, [User::ROLE_PICKUP, User::ROLE_MANAGER]), 403);

        $updated = DB::transaction(function () use ($order, $data, $actor, $request): Order {
            $locked = Order::query()->lockForUpdate()->findOrFail($order->id);
            abort_unless($locked->status === 'ready', 409, 'Payment can only be recorded for a ready pickup order.');
            abort_unless($this->cents($data['amount']) === $this->cents($locked->total), 422, 'The cash amount must match the order total.');
            if ($locked->payment_status === 'paid') {
                abort_unless($locked->payment()->exists(), 409, 'The order payment record is inconsistent.');
                return $locked->load(['branch.restaurant', 'items.options', 'payment']);
            }
            $locked->payment()->create([
                'recorded_by' => $actor->id,
                'method' => 'cash_at_pickup',
                'status' => 'paid',
                'amount' => $locked->total,
                'paid_at' => now(),
            ]);
            $locked->payment_status = 'paid';
            $locked->save();
            AuditLog::create(['actor_id' => $actor->id, 'event' => 'order.payment_recorded', 'subject_type' => 'order', 'subject_id' => $locked->id, 'metadata' => ['method' => 'cash_at_pickup', 'amount' => $locked->total], 'ip_address' => $request->ip(), 'created_at' => now()]);
            return $locked->load(['branch.restaurant', 'items.options', 'payment']);
        });
        OrderUpdated::dispatch($updated);
        return response()->json($updated);
    }

    public function redeemPickup(Request $request, Order $order): JsonResponse
    {
        $data = $request->validate(['pickup_token' => ['required', 'string', 'max:100']]);
        $actor = $request->user();
        abort_unless($actor->isAdministrator() || $actor->hasBranchRole($order->branch_id, [User::ROLE_PICKUP, User::ROLE_MANAGER]), 403);

        $updated = DB::transaction(function () use ($order, $data, $actor, $request): Order {
            $locked = Order::query()->lockForUpdate()->findOrFail($order->id);
            abort_unless($locked->status === 'ready', 409, 'The order is not ready for pickup.');
            abort_unless($locked->payment_status === 'paid' && $locked->payment()->exists(), 409, 'Record cash payment before completing this pickup.');
            $validToken = $locked->pickup_code_hash !== null && hash_equals($locked->pickup_code_hash, hash('sha256', $data['pickup_token']));
            abort_unless($locked->pickup_code_used_at === null && $validToken, 422, 'Pickup code is invalid or already used.');
            $locked->pickup_code_used_at = now();
            $locked->status = 'picked_up';
            $locked->save();
            OrderStatusHistory::create(['order_id' => $locked->id, 'actor_id' => $actor->id, 'from_status' => 'ready', 'to_status' => 'picked_up', 'note' => 'Pickup completed after cash payment.']);
            AuditLog::create(['actor_id' => $actor->id, 'event' => 'order.picked_up', 'subject_type' => 'order', 'subject_id' => $locked->id, 'metadata' => ['payment_status' => 'paid'], 'ip_address' => $request->ip(), 'created_at' => now()]);
            return $locked->load(['branch.restaurant', 'items.options', 'statusHistory']);
        });
        $updated->customer->notify(new OrderStatusNotification($updated));
        OrderUpdated::dispatch($updated);
        return response()->json($updated);
    }

    private function reserveSlot(Branch $branch, CarbonImmutable $requested, bool $requireOpenNow): array
    {
        $local = $requested->setTimezone($branch->timezone);
        $weekday = $local->dayOfWeek;
        $hours = BusinessHour::query()->where('branch_id', $branch->id)->where('weekday', $weekday)->lockForUpdate()->first();
        if (! $hours || $hours->is_closed || ! $hours->opens_at || ! $hours->closes_at) {
            throw ValidationException::withMessages(['pickup_at' => ['This branch is closed at the requested time.']]);
        }
        $open = CarbonImmutable::parse($local->toDateString().' '.$hours->opens_at, $branch->timezone);
        $close = CarbonImmutable::parse($local->toDateString().' '.$hours->closes_at, $branch->timezone);
        if ($requireOpenNow) {
            $now = CarbonImmutable::now($branch->timezone);
            $openNow = $hours->weekday === $now->dayOfWeek && ! $now->lt($open) && $now->lt($close);
            if (! $openNow) throw ValidationException::withMessages(['branch_id' => ['This branch is currently closed. Choose a scheduled pickup time instead.']]);
        }
        $interval = max(5, (int) $hours->slot_interval_minutes);
        $minutesFromOpen = max(0, $open->diffInMinutes($local, false));
        $slotMinute = (int) (ceil($minutesFromOpen / $interval) * $interval);
        $pickupAt = $open->addMinutes($slotMinute);
        if ($pickupAt->lt($local)) $pickupAt = $pickupAt->addMinutes($interval);
        if (! $pickupAt->lt($close)) {
            throw ValidationException::withMessages(['pickup_at' => ['No pickup slots remain before closing time.']]);
        }
        $slotEnd = $pickupAt->addMinutes($interval);
        $reserved = Order::query()->where('branch_id', $branch->id)
            ->whereIn('status', self::ACTIVE_STATUSES)
            ->where('pickup_at', '>=', $pickupAt->utc())
            ->where('pickup_at', '<', $slotEnd->utc())
            ->count();
        if ($reserved >= $hours->orders_per_slot) {
            throw ValidationException::withMessages(['pickup_at' => ['This pickup time is full. Choose another time.']]);
        }
        return ['pickup_at' => $pickupAt];
    }

    private function cents(string|float|int $value): int
    {
        return (int) round(((float) $value) * 100);
    }

    private function decryptPickupToken(Order $order): ?string
    {
        try {
            return $order->pickup_token_encrypted ? Crypt::decryptString($order->pickup_token_encrypted) : null;
        } catch (\Throwable) {
            return null;
        }
    }

    private function orderPayload(Order $order, ?string $pickupToken): array
    {
        $order->loadMissing(['branch.restaurant', 'items.options']);
        return ['order' => $order, 'pickup_token' => $pickupToken, 'pickup_qr_value' => $pickupToken];
    }
}
