<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('branch_id')->constrained()->restrictOnDelete();
            $table->foreignId('customer_id')->constrained('users')->restrictOnDelete();
            $table->string('status', 32)->default('pending_confirmation')->index();
            $table->string('fulfillment_type', 16)->default('pickup');
            $table->string('schedule_type', 16)->default('asap');
            $table->dateTime('pickup_at')->index();
            $table->string('payment_method', 24)->default('cash_at_pickup');
            $table->string('payment_status', 24)->default('unpaid');
            $table->decimal('subtotal', 10, 2);
            $table->decimal('total', 10, 2);
            $table->string('idempotency_key', 100);
            $table->char('pickup_code_hash', 64)->nullable()->unique();
            $table->text('pickup_token_encrypted')->nullable();
            $table->timestamp('pickup_code_used_at')->nullable();
            $table->unsignedSmallInteger('eta_minutes')->nullable();
            $table->text('customer_note')->nullable();
            $table->timestamps();
            $table->unique(['customer_id', 'idempotency_key']);
            $table->index(['branch_id', 'pickup_at', 'status']);
        });

        Schema::create('order_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->string('product_name');
            $table->decimal('unit_price', 10, 2);
            $table->unsignedSmallInteger('quantity');
            $table->decimal('line_total', 10, 2);
            $table->string('prep_station', 32)->default('packaging');
            $table->unsignedSmallInteger('prep_minutes')->default(15);
            $table->timestamps();
        });

        Schema::create('order_item_options', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('order_item_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_option_id')->nullable()->constrained()->nullOnDelete();
            $table->string('group_name');
            $table->string('option_name');
            $table->decimal('price_delta', 10, 2);
            $table->timestamps();
        });

        Schema::create('order_status_history', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('from_status', 32)->nullable();
            $table->string('to_status', 32);
            $table->text('note')->nullable();
            $table->timestamps();
            $table->index(['order_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_status_history');
        Schema::dropIfExists('order_item_options');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
    }
};
