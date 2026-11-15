<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Order extends Model
{
    public const STATUSES = [
        'pending_confirmation', 'confirmed', 'preparing', 'ready', 'picked_up', 'cancelled', 'rejected',
    ];

    protected $fillable = [
        'branch_id', 'customer_id', 'status', 'fulfillment_type', 'schedule_type', 'pickup_at',
        'estimated_ready_at', 'packaging_confirmed_at',
        'payment_method', 'payment_status', 'subtotal', 'total', 'idempotency_key',
        'request_fingerprint', 'pickup_code_hash', 'pickup_token_encrypted', 'pickup_code_used_at', 'eta_minutes', 'customer_note',
    ];

    protected $hidden = ['idempotency_key', 'request_fingerprint', 'pickup_code_hash', 'pickup_token_encrypted'];

    protected function casts(): array
    {
        return [
            'pickup_at' => 'datetime',
            'estimated_ready_at' => 'datetime',
            'packaging_confirmed_at' => 'datetime',
            'pickup_code_used_at' => 'datetime',
            'subtotal' => 'decimal:2',
            'total' => 'decimal:2',
        ];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function statusHistory(): HasMany
    {
        return $this->hasMany(OrderStatusHistory::class);
    }

    public function etaHistory(): HasMany
    {
        return $this->hasMany(OrderEtaHistory::class);
    }

    public function payment(): HasOne
    {
        return $this->hasOne(Payment::class);
    }
}
