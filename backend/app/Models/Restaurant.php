<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Restaurant extends Model
{
    public const BUSINESS_TYPES = ['pizzeria', 'fast_food', 'traditional_restaurant', 'cafe', 'bakery', 'sweet_shop', 'healthy_kitchen'];

    protected $fillable = [
        'owner_id', 'name', 'slug', 'business_type', 'description', 'image_path', 'status',
    ];

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function branches(): HasMany
    {
        return $this->hasMany(Branch::class);
    }

    public function categories(): HasMany
    {
        return $this->hasMany(ProductCategory::class);
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }
}
