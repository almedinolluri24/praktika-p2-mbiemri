<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\Rule;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Support\Str;
use App\Models\User;

class AuthenticatedSessionController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'remember' => ['sometimes', 'boolean'],
        ]);

        if (! Auth::attempt(
            ['email' => $credentials['email'], 'password' => $credentials['password']],
            $request->boolean('remember'),
        )) {
            return response()->json([
                'message' => 'Email or password is incorrect.',
                'errors' => ['email' => ['Email or password is incorrect.']],
            ], 422);
        }

        $user = $request->user();
        if (! $user->is_active) {
            Auth::logout();
            return response()->json([
                'message' => 'Email or password is incorrect.',
                'errors' => ['email' => ['Email or password is incorrect.']],
            ], 422);
        }

        $request->session()->regenerate();

        return response()->json([
            'user' => ['id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'role' => $user->role,
                'branch_ids' => $user->staffBranches()->wherePivotIn('role', User::STAFF_ROLES)->pluck('branches.id')->map(fn ($id) => (int) $id)->values()],
        ]);
    }

    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => $data['password'],
            'role' => User::ROLE_CUSTOMER,
        ]);
        Auth::login($user);
        $request->session()->regenerate();

        return response()->json([
            'user' => ['id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'role' => $user->role, 'branch_ids' => []],
        ], 201);
    }

    public function destroy(Request $request): JsonResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'You have been logged out.']);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($request->user()->id)],
        ]);
        $request->user()->update($data);

        return response()->json(['user' => [
            'id' => $request->user()->id,
            'name' => $request->user()->name,
            'email' => $request->user()->email,
            'role' => $request->user()->role,
            'branch_ids' => $request->user()->staffBranches()->wherePivotIn('role', User::STAFF_ROLES)->pluck('branches.id')->map(fn ($id) => (int) $id)->values(),
        ]]);
    }

    public function sendResetLink(Request $request): JsonResponse
    {
        $request->validate([
            'email' => ['required', 'email', 'max:255'],
        ]);

        Password::sendResetLink($request->only('email'));

        return response()->json([
            'message' => 'Nëse ekziston llogaria, do të dërgohet një lidhje për rivendosjen e fjalëkalimit.',
        ], 202);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email', 'max:255'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $status = Password::reset($data, function (User $user, string $password): void {
            $user->forceFill([
                'password' => $password,
                'remember_token' => Str::random(60),
            ])->save();
            event(new PasswordReset($user));
        });

        if ($status !== Password::PASSWORD_RESET) {
            return response()->json([
                'message' => 'Lidhja e rivendosjes është e pavlefshme ose ka skaduar.',
            ], 422);
        }

        return response()->json([
            'message' => 'Fjalëkalimi u rivendos me sukses. Tani mund të kyçeni.',
        ]);
    }
}
