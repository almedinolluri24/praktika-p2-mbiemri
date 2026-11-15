<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('role', 32)->default('customer')->index();
        });

        Schema::create('restaurants', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('owner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('business_type', 40)->index();
            $table->text('description')->nullable();
            $table->string('image_path')->nullable();
            $table->string('status', 24)->default('pending')->index();
            $table->timestamps();
        });

        Schema::create('branches', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('restaurant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('city');
            $table->string('address');
            $table->string('phone', 40)->nullable();
            $table->string('timezone', 64)->default('Europe/Belgrade');
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
            $table->unique(['restaurant_id', 'name']);
        });

        Schema::create('branch_staff', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('role', 32);
            $table->timestamps();
            $table->unique(['branch_id', 'user_id']);
            $table->index(['user_id', 'role']);
        });

        Schema::create('business_hours', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('weekday');
            $table->time('opens_at')->nullable();
            $table->time('closes_at')->nullable();
            $table->unsignedSmallInteger('slot_interval_minutes')->default(15);
            $table->unsignedSmallInteger('orders_per_slot')->default(8);
            $table->boolean('is_closed')->default(false);
            $table->timestamps();
            $table->unique(['branch_id', 'weekday']);
        });

        Schema::create('product_categories', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('restaurant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('slug');
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['restaurant_id', 'slug']);
        });

        Schema::create('products', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('restaurant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->constrained('product_categories')->restrictOnDelete();
            $table->string('name');
            $table->string('slug');
            $table->text('description')->nullable();
            $table->string('image_path')->nullable();
            $table->decimal('price', 10, 2);
            $table->unsignedSmallInteger('prep_minutes')->default(15);
            $table->string('prep_station', 32)->default('packaging');
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_available')->default(true)->index();
            $table->timestamps();
            $table->unique(['restaurant_id', 'slug']);
            $table->index(['restaurant_id', 'category_id', 'is_available']);
        });

        Schema::create('branch_products', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->boolean('is_available')->default(true);
            $table->decimal('price_override', 10, 2)->nullable();
            $table->timestamps();
            $table->unique(['branch_id', 'product_id']);
            $table->index(['branch_id', 'is_available']);
        });

        Schema::create('option_groups', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('restaurant_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->boolean('is_required')->default(false);
            $table->unsignedTinyInteger('min_selections')->default(0);
            $table->unsignedTinyInteger('max_selections')->default(1);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('product_options', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('option_group_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->decimal('price_delta', 10, 2)->default(0);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_available')->default(true);
            $table->timestamps();
        });

        Schema::create('option_group_product', function (Blueprint $table): void {
            $table->foreignId('option_group_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->primary(['option_group_id', 'product_id']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('option_group_product');
        Schema::dropIfExists('product_options');
        Schema::dropIfExists('option_groups');
        Schema::dropIfExists('branch_products');
        Schema::dropIfExists('products');
        Schema::dropIfExists('product_categories');
        Schema::dropIfExists('business_hours');
        Schema::dropIfExists('branch_staff');
        Schema::dropIfExists('branches');
        Schema::dropIfExists('restaurants');

        Schema::table('users', function (Blueprint $table): void {
            $table->dropIndex(['role']);
            $table->dropColumn('role');
        });
    }
};
