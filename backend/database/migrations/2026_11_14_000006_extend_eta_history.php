<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_eta_history', function (Blueprint $table): void {
            $table->unsignedSmallInteger('previous_eta_minutes')->nullable()->after('actor_id');
            $table->dateTime('estimated_ready_at')->nullable()->after('eta_minutes');
        });
    }

    public function down(): void
    {
        Schema::table('order_eta_history', function (Blueprint $table): void {
            $table->dropColumn(['previous_eta_minutes', 'estimated_ready_at']);
        });
    }
};
