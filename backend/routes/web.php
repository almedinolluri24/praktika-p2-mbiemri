<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\BroadcastChannelAuthController;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/api/csrf-cookie', fn () => response()->noContent());
Route::post('/api/login', [AuthenticatedSessionController::class, 'store'])->middleware('throttle:5,1');
Route::post('/api/login/verify', [AuthenticatedSessionController::class, 'verifyLoginCode'])->middleware('throttle:10,1');
Route::post('/api/login/resend-code', [AuthenticatedSessionController::class, 'resendLoginCode'])->middleware('throttle:3,1');
Route::post('/api/register', [AuthenticatedSessionController::class, 'register'])->middleware('throttle:5,1');
Route::post('/api/forgot-password', [AuthenticatedSessionController::class, 'sendResetLink'])->middleware('throttle:5,1');
Route::post('/api/reset-password', [AuthenticatedSessionController::class, 'resetPassword'])->middleware('throttle:5,1');
Route::get('/api/user', fn () => response()->json([
    'user' => ['id' => auth()->id(), 'name' => auth()->user()->name, 'email' => auth()->user()->email, 'role' => auth()->user()->role,
        'branch_ids' => auth()->user()->staffBranches()->wherePivotIn('role', \App\Models\User::STAFF_ROLES)->pluck('branches.id')->map(fn ($id) => (int) $id)->values()],
]))->middleware(['auth', 'account.active']);
Route::patch('/api/profile', [AuthenticatedSessionController::class, 'updateProfile'])->middleware(['auth', 'account.active']);
// Inactive users must still be able to end their session.
Route::post('/api/logout', [AuthenticatedSessionController::class, 'destroy'])->middleware('auth');
Route::post('/broadcasting/auth', [BroadcastChannelAuthController::class, 'authorize'])->middleware(['auth', 'account.active']);
