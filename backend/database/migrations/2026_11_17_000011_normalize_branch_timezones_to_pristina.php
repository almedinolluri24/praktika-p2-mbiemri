<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('branches', function (Blueprint $table): void {
            $table->string('timezone', 64)->default('Europe/Pristina')->change();
        });

        DB::table('branches')->where('timezone', 'Europe/Belgrade')->update(['timezone' => 'Europe/Pristina']);
    }

    public function down(): void
    {
        Schema::table('branches', function (Blueprint $table): void {
            $table->string('timezone', 64)->default('Europe/Belgrade')->change();
        });

        DB::table('branches')->where('timezone', 'Europe/Pristina')->update(['timezone' => 'Europe/Belgrade']);
    }
};
