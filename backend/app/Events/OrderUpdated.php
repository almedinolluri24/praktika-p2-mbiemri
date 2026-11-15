<?php

namespace App\Events;

use App\Models\Order;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class OrderUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public readonly Order $order) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('branches.'.$this->order->branch_id),
            new PrivateChannel('orders.customer.'.$this->order->customer_id),
        ];
    }

    public function broadcastAs(): string
    {
        return 'order.updated';
    }

    public function broadcastWith(): array
    {
        return [
            'id' => $this->order->id,
            'branch_id' => $this->order->branch_id,
            'status' => $this->order->status,
            'eta_minutes' => $this->order->eta_minutes,
            'estimated_ready_at' => $this->order->estimated_ready_at?->toIso8601String(),
            'updated_at' => $this->order->updated_at?->toIso8601String(),
        ];
    }
}
