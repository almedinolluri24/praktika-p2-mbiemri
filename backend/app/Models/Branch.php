<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Branch extends Model
{
    protected $fillable = [
        'restaurant_id', 'name', 'city', 'address', 'pickup_instructions', 'phone', 'timezone', 'is_active',
    ];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }

    public function products(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'branch_products')
            ->withPivot(['is_available', 'price_override'])
            ->withTimestamps();
    }

    public function staff(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'branch_staff')
            ->withPivot('role')
            ->withTimestamps();
    }

    public function timezoneForCalculations(): string
    {
        try {
            new \DateTimeZone($this->timezone ?: 'Europe/Pristina');
            return $this->timezone ?: 'Europe/Pristina';
        } catch (\Throwable) {
            // Some Windows PHP timezone databases omit Kosovo's IANA entry; Belgrade observes the same civil-time rules.
            if ($this->timezone === 'Europe/Pristina') return 'Europe/Belgrade';
            throw new \InvalidArgumentException('Unsupported branch timezone: '.$this->timezone);
        }
    }

    public function businessHours(): HasMany
    {
        return $this->hasMany(BusinessHour::class);
    }
}
