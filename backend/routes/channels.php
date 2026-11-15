<?php

use App\Models\Order;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('branches.{branchId}', function (User $user, int $branchId): bool {
    return $user->isAdministrator() || $user->hasBranchRole($branchId, User::STAFF_ROLES);
});

Broadcast::channel('orders.customer.{customerId}', fn (User $user, int $customerId): bool => $user->id === $customerId);

Broadcast::channel('orders.{orderId}', function (User $user, int $orderId): bool {
    $order = Order::find($orderId);
    return $order && ($user->isAdministrator() || $order->customer_id === $user->id || $user->hasBranchRole($order->branch_id, User::STAFF_ROLES));
});
