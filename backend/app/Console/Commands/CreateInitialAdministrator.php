<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

class CreateInitialAdministrator extends Command
{
    protected $signature = 'admin:create-initial';

    protected $description = 'Create the first administrator using private interactive prompts';

    public function handle(): int
    {
        if (User::query()->where('role', User::ROLE_ADMIN)->exists()) {
            $this->error('An administrator already exists. Ask an existing administrator to grant access.');

            return self::FAILURE;
        }

        $name = trim((string) $this->ask('Administrator name'));
        $email = mb_strtolower(trim((string) $this->ask('Administrator email')));
        $identity = Validator::make(compact('name', 'email'), [
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
        ])->validate();

        $password = (string) $this->secret('Administrator password (at least 12 characters)');
        $confirmation = (string) $this->secret('Confirm administrator password');
        Validator::make(['password' => $password, 'password_confirmation' => $confirmation], [
            'password' => ['required', 'confirmed', Password::min(12)->letters()->mixedCase()->numbers()->symbols()],
        ])->validate();

        DB::transaction(function () use ($identity, $password): void {
            User::create([
                'name' => $identity['name'],
                'email' => $identity['email'],
                'password' => $password,
                'role' => User::ROLE_ADMIN,
                'is_active' => true,
            ]);
        });

        $this->info('Initial administrator created. You can now sign in with that email.');

        return self::SUCCESS;
    }
}
