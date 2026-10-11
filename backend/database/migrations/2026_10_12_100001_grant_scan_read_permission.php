<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    // Scan Lot used to open with the Finished Goods permission: those users keep it.
    public function up(): void
    {
        foreach (DB::table('users')->where('role', '!=', 'admin')->get(['id', 'permissions']) as $user) {
            $perms = $this->decode($user->permissions);
            if ((in_array('finished_goods.read', $perms, true) || in_array('finished_goods.write', $perms, true)) && !in_array('scan.read', $perms, true)) {
                $perms[] = 'scan.read';
                DB::table('users')->where('id', $user->id)->update(['permissions' => json_encode(array_values($perms))]);
            }
        }
    }

    /** Permissions may be a JSON array or, for some seeded users, a JSON string holding JSON. */
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
            $perms = array_values(array_diff($this->decode($user->permissions), ['scan.read']));
            DB::table('users')->where('id', $user->id)->update(['permissions' => json_encode($perms)]);
        }
    }
};
