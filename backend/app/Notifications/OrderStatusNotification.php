<?php

namespace App\Notifications;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class OrderStatusNotification extends Notification
{
    use Queueable;

    public function __construct(private readonly Order $order) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'order_id' => $this->order->id,
            'status' => $this->order->status,
            'eta_minutes' => $this->order->eta_minutes,
            'estimated_ready_at' => $this->order->estimated_ready_at?->toIso8601String(),
            'message' => 'Your pickup order status changed to '.str_replace('_', ' ', $this->order->status).'.',
        ];
    }
}
