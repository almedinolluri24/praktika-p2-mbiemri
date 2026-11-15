<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->dateTime('estimated_ready_at')->nullable()->after('pickup_at');
            $table->timestamp('packaging_confirmed_at')->nullable()->after('estimated_ready_at');
        });
        Schema::table('order_items', function (Blueprint $table): void {
            $table->string('prep_status', 20)->default('pending')->after('prep_station');
            $table->timestamp('completed_at')->nullable()->after('prep_status');
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table): void {
            $table->dropColumn(['prep_status', 'completed_at']);
        });
        Schema::table('orders', function (Blueprint $table): void {
            $table->dropColumn(['estimated_ready_at', 'packaging_confirmed_at']);
        });
    }
};
