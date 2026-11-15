<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    public const ROLE_VISITOR = 'visitor';

    public const ROLE_CUSTOMER = 'customer';

    public const ROLE_MANAGER = 'restaurant_manager';

    public const ROLE_KITCHEN = 'kitchen_worker';

    public const ROLE_PICKUP = 'pickup_worker';

    public const ROLE_ADMIN = 'administrator';

    public const REGISTERABLE_ROLES = [self::ROLE_CUSTOMER];

    public const ROLES = [self::ROLE_VISITOR, self::ROLE_CUSTOMER, self::ROLE_MANAGER, self::ROLE_KITCHEN, self::ROLE_PICKUP, self::ROLE_ADMIN];

    public const STAFF_ROLES = [self::ROLE_MANAGER, self::ROLE_KITCHEN, self::ROLE_PICKUP];

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function ownedRestaurants()
    {
        return $this->hasMany(Restaurant::class, 'owner_id');
    }

    public function staffBranches()
    {
        return $this->belongsToMany(Branch::class, 'branch_staff')
            ->withPivot('role')
            ->withTimestamps();
    }

    public function isAdministrator(): bool
    {
        return $this->role === self::ROLE_ADMIN;
    }

    public function hasBranchRole(int $branchId, array|string $roles): bool
    {
        $roles = (array) $roles;

        return $this->staffBranches()
            ->where('branches.id', $branchId)
            ->wherePivotIn('role', $roles)
            ->exists();
    }
}
