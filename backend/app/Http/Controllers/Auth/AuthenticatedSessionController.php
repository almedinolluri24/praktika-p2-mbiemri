<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\Rule;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Support\Str;
use App\Models\User;
use App\Notifications\LoginVerificationCode;
use Throwable;

class AuthenticatedSessionController extends Controller
{
    private const LOGIN_CHALLENGE = 'auth.email_code_challenge';

    public function store(Request $request): JsonResponse
    {
        $this->normalizeEmail($request);
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'remember' => ['sometimes', 'boolean'],
        ]);

        $user = User::query()->where('email', $credentials['email'])->first();
        if (! $user || ! Hash::check($credentials['password'], $user->password) || ! $user->is_active) {
            return response()->json([
                'message' => 'Email or password is incorrect.',
                'errors' => ['email' => ['Email or password is incorrect.']],
            ], 422);
        }

        if (Auth::check()) {
            Auth::logout();
        }
        $code = $this->newLoginCode();
        $request->session()->regenerate();
        $request->session()->put(self::LOGIN_CHALLENGE, [
            'user_id' => $user->id,
            'code_hash' => Hash::make($code),
            'expires_at' => now()->addMinutes(5)->timestamp,
            'attempts' => 0,
            'remember' => $request->boolean('remember'),
            'mark_email_verified' => false,
        ]);

        if (! $this->sendLoginCode($user, $code)) {
            return response()->json(['message' => 'Kodi i verifikimit nuk u dërgua. Kontrollo konfigurimin e email-it dhe provo përsëri.'], 503);
        }

        return response()->json([
            'challenge_required' => true,
            'email' => $user->email,
            'message' => 'Kodi i verifikimit u dërgua në email-in tënd.',
        ]);
    }

    public function verifyLoginCode(Request $request): JsonResponse
    {
        $data = $request->validate(['code' => ['required', 'regex:/^\d{6}$/']]);
        $challenge = $request->session()->get(self::LOGIN_CHALLENGE);
        if (! is_array($challenge) || ($challenge['expires_at'] ?? 0) <= now()->timestamp) {
            $request->session()->forget(self::LOGIN_CHALLENGE);
            return response()->json(['message' => 'Kodi ka skaduar. Kyçu përsëri për të marrë një kod të ri.'], 422);
        }
        if (($challenge['attempts'] ?? 0) >= 5) {
            $request->session()->forget(self::LOGIN_CHALLENGE);
            return response()->json(['message' => 'U tejkalua numri i provave. Kyçu përsëri për të marrë një kod të ri.'], 422);
        }

        $user = User::query()->find($challenge['user_id'] ?? null);
        if (! $user || ! $user->is_active) {
            $request->session()->forget(self::LOGIN_CHALLENGE);
            return response()->json(['message' => 'Kodi është i pavlefshëm. Kyçu përsëri.'], 422);
        }

        if (! Hash::check($data['code'], $challenge['code_hash'] ?? '')) {
            $challenge['attempts']++;
            if ($challenge['attempts'] >= 5) {
                $request->session()->forget(self::LOGIN_CHALLENGE);
                return response()->json(['message' => 'U tejkalua numri i provave. Kyçu përsëri për të marrë një kod të ri.'], 422);
            }
            $request->session()->put(self::LOGIN_CHALLENGE, $challenge);
            return response()->json(['message' => 'Kodi i verifikimit është i pasaktë.'], 422);
        }

        $request->session()->forget(self::LOGIN_CHALLENGE);
        if ($challenge['mark_email_verified'] ?? false) {
            $user->forceFill(['email_verified_at' => now()])->save();
        }
        Auth::login($user, (bool) ($challenge['remember'] ?? false));
        $request->session()->regenerate();

        return response()->json(['user' => $this->userPayload($user)]);
    }

    public function resendLoginCode(Request $request): JsonResponse
    {
        $challenge = $request->session()->get(self::LOGIN_CHALLENGE);
        if (! is_array($challenge) || ($challenge['expires_at'] ?? 0) <= now()->timestamp) {
            $request->session()->forget(self::LOGIN_CHALLENGE);
            return response()->json(['message' => 'Kyçu përsëri për të marrë një kod verifikimi.'], 422);
        }

        $user = User::query()->find($challenge['user_id'] ?? null);
        if (! $user || ! $user->is_active) {
            $request->session()->forget(self::LOGIN_CHALLENGE);
            return response()->json(['message' => 'Llogaria nuk mund të kyçet.'], 422);
        }

        $code = $this->newLoginCode();
        if (! $this->sendLoginCode($user, $code)) {
            return response()->json(['message' => 'Kodi i verifikimit nuk u dërgua. Provo përsëri.'], 503);
        }

        $challenge['code_hash'] = Hash::make($code);
        $challenge['expires_at'] = now()->addMinutes(5)->timestamp;
        $challenge['attempts'] = 0;
        $request->session()->put(self::LOGIN_CHALLENGE, $challenge);

        return response()->json(['message' => 'Kodi i ri u dërgua në email-in tënd.']);
    }

    private function newLoginCode(): string
    {
        return str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    }

    private function sendLoginCode(User $user, string $code): bool
    {
        try {
            $user->notify(new LoginVerificationCode($code));
            return true;
        } catch (Throwable $exception) {
            Log::warning('Could not send a sign-in verification code.', ['user_id' => $user->id, 'exception' => $exception::class]);
            return false;
        }
    }

    private function userPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'branch_ids' => $user->staffBranches()->wherePivotIn('role', User::STAFF_ROLES)->pluck('branches.id')->map(fn ($id) => (int) $id)->values(),
        ];
    }

    public function register(Request $request): JsonResponse
    {
        $this->normalizeEmail($request);
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
        if (Auth::check()) {
            Auth::logout();
        }
        $request->session()->regenerate();
        $code = $this->newLoginCode();
        $request->session()->put(self::LOGIN_CHALLENGE, [
            'user_id' => $user->id,
            'code_hash' => Hash::make($code),
            'expires_at' => now()->addMinutes(5)->timestamp,
            'attempts' => 0,
            'remember' => false,
            'mark_email_verified' => true,
        ]);
        if (! $this->sendLoginCode($user, $code)) {
            return response()->json(['message' => 'Llogaria u krijua, por kodi i verifikimit nuk u dërgua. Provo të kyçesh sërish pasi të kontrollosh konfigurimin e email-it.'], 503);
        }

        return response()->json([
            'challenge_required' => true,
            'email' => $user->email,
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
        $this->normalizeEmail($request);
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
        $this->normalizeEmail($request);
        $request->validate([
            'email' => ['required', 'email', 'max:255'],
        ]);

        try {
            Password::sendResetLink($request->only('email'));
        } catch (Throwable $exception) {
            Log::warning('Could not send a password reset email.', [
                'exception' => $exception::class,
            ]);

            return response()->json([
                'message' => 'Emaili për rivendosjen e fjalëkalimit nuk u dërgua. Kontrollo konfigurimin e email-it dhe provo përsëri.',
            ], 503);
        }

        return response()->json([
            'message' => 'Nëse ekziston llogaria, do të dërgohet një lidhje për rivendosjen e fjalëkalimit.',
        ], 202);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $this->normalizeEmail($request);
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

    private function normalizeEmail(Request $request): void
    {
        $email = $request->input('email');
        if (is_string($email)) {
            $request->merge(['email' => mb_strtolower(trim($email))]);
        }
    }
}
