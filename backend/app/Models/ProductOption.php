<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductOption extends Model
{
    protected $fillable = ['option_group_id', 'name', 'price_delta', 'sort_order', 'is_available'];

    protected function casts(): array
    {
        return ['price_delta' => 'decimal:2', 'is_available' => 'boolean'];
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(OptionGroup::class, 'option_group_id');
    }
}
