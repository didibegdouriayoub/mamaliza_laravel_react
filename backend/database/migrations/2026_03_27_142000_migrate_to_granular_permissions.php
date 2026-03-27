<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Seed new permissions
        $permissions = [
            'inventory.read', 'inventory.write',
            'recipes.read', 'recipes.write',
            'batches.read', 'batches.write',
            'quality.read', 'quality.write',
            'sales.read', 'sales.write',
            'suppliers.read', 'suppliers.write',
            'customers.read', 'customers.write',
            'users.read', 'users.write',
            'permissions.read', 'permissions.write',
        ];

        foreach ($permissions as $p) {
            \Illuminate\Support\Facades\DB::table('permissions')->updateOrInsert(
                ['name' => $p],
                ['created_at' => now(), 'updated_at' => now()]
            );
        }

        // 2. Migrate existing users
        $users = \App\Models\User::all();
        $mapping = [
            'manage_inventory' => 'inventory.write',
            'view_inventory'   => 'inventory.read',
            'manage_recipes'   => 'recipes.write',
            'view_recipes'     => 'recipes.read',
            'manage_batches'   => 'batches.write',
            'view_batches'     => 'batches.read',
            'manage_quality'   => 'quality.write',
            'view_quality'     => 'quality.read',
            'manage_users'     => 'users.write',
            'view_users'       => 'users.read',
            'production.write' => 'batches.write',
            'production.read'  => 'batches.read',
        ];

        foreach ($users as $user) {
            $oldPerms = $user->getRawOriginal('permissions');
            if (is_string($oldPerms)) {
                $oldPerms = json_decode($oldPerms, true);
            }
            if (!is_array($oldPerms)) continue;
            
            $newPerms = [];
            foreach ($oldPerms as $p) {
                if (isset($mapping[$p])) {
                    $newPerms[] = $mapping[$p];
                } else {
                    $newPerms[] = $p; // Keep 'all' or others
                }
            }
            
            $user->permissions = array_unique($newPerms);
            $user->save();
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No easy rollback for data mapping without losing precision
    }
};
