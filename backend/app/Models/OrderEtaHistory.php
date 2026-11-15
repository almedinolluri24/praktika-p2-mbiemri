<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderEtaHistory extends Model
{
    protected $table = 'order_eta_history';

    protected $fillable = ['order_id', 'actor_id', 'previous_eta_minutes', 'eta_minutes', 'estimated_ready_at', 'reason'];

    protected function casts(): array
    {
        return ['estimated_ready_at' => 'datetime'];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
