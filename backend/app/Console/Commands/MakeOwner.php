<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Makes one account the owner: always admin, sees everything, and cannot be changed or deleted
 * from the app. Also the way to get back in if an account lost its access.
 *
 *   php artisan user:make-owner you@example.com
 */
class MakeOwner extends Command
{
    protected $signature = 'user:make-owner {email : Login email of the account}';

    protected $description = 'Make an account the unchangeable owner (always admin)';

    public function handle(): int
    {
        $email = trim((string) $this->argument('email'));
        $user = DB::table('users')->whereRaw('LOWER(email) = ?', [strtolower($email)])->first();

        if (!$user) {
            $this->error("No user with the email \"{$email}\". Existing accounts:");
            foreach (DB::table('users')->orderBy('id')->get(['id', 'name', 'email', 'role']) as $u) {
                $this->line("  #{$u->id}  {$u->email}  ({$u->name}, {$u->role})");
            }

            return self::FAILURE;
        }

        // direct updates: this is the only place that may change the owner flag
        DB::table('users')->where('is_owner', true)->where('id', '!=', $user->id)->update(['is_owner' => false]);
        DB::table('users')->where('id', $user->id)->update(['is_owner' => true, 'role' => 'admin']);

        $this->info("{$user->email} is now the owner: always admin, cannot be changed or deleted.");

        return self::SUCCESS;
    }
}
