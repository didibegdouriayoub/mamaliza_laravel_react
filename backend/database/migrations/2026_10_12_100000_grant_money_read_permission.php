<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    // Pages that only make sense with money in view: users who have them keep seeing money after this change.
    private array $needsMoney = ['sales.read', 'sales.write', 'analytics.read', 'estimation.read', 'estimation.write'];

    public function up(): void
    {
        foreach (DB::table('users')->where('role', '!=', 'admin')->get(['id', 'permissions']) as $user) {
            $perms = $this->decode($user->permissions);
            if (array_intersect($this->needsMoney, $perms) && !in_array('money.read', $perms, true)) {
                $perms[] = 'money.read';
                DB::table('users')->where('id', $user->id)->update(['permissions' => json_encode(array_values($perms))]);
            }
        }
    }

    /** Permissions may be stored as a JSON array or, for some seeded users, as a JSON string holding JSON. */
    private function decode($value): array
    {
        for ($i = 0; $i < 3 && is_string($value) && $value !== ''; $i++) {
            $value = json_decode($value, true);
        }

        return is_array($value) ? $value : [];
    }

    public function down(): void
    {
        foreach (DB::table('users')->get(['id', 'permissions']) as $user) {
            $perms = array_values(array_diff($this->decode($user->permissions), ['money.read']));
            DB::table('users')->where('id', $user->id)->update(['permissions' => json_encode($perms)]);
        }
    }
};
