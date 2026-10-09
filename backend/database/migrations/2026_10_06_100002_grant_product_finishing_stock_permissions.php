<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Products, Finishing and Finished Goods get their own permission rows.
 * Give them to users who could already use those pages, so nobody loses access.
 *   read  <- analytics.read / sales.read / batches.read
 *   write <- sales.write / batches.write
 */
return new class extends Migration {
    private const READ  = ['products.read', 'finishing.read', 'finished_goods.read'];
    private const WRITE = ['products.write', 'finishing.write', 'finished_goods.write'];

    public function up(): void
    {
        foreach (DB::table('users')->where('role', '!=', 'admin')->get() as $user) {
            $perms = json_decode($user->permissions ?? '[]', true);
            if (!is_array($perms)) {
                continue;
            }

            $new = $perms;
            if (array_intersect($perms, ['analytics.read', 'sales.read', 'batches.read', 'sales.write', 'batches.write'])) {
                $new = array_merge($new, self::READ);
            }
            if (array_intersect($perms, ['sales.write', 'batches.write'])) {
                $new = array_merge($new, self::WRITE);
            }

            $new = array_values(array_unique($new));
            if ($new !== $perms) {
                DB::table('users')->where('id', $user->id)->update(['permissions' => json_encode($new)]);
            }
        }
    }

    public function down(): void
    {
        $all = array_merge(self::READ, self::WRITE);
        foreach (DB::table('users')->get() as $user) {
            $perms = json_decode($user->permissions ?? '[]', true);
            if (is_array($perms)) {
                DB::table('users')->where('id', $user->id)
                    ->update(['permissions' => json_encode(array_values(array_diff($perms, $all)))]);
            }
        }
    }
};
