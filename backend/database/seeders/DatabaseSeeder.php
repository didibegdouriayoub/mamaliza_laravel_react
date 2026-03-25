<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // 1. Users
        $adminId = \Illuminate\Support\Facades\DB::table('users')->insertGetId([
            'name' => 'Admin User',
            'email' => 'admin@fromagerie.com',
            'password' => \Illuminate\Support\Facades\Hash::make('password'),
            'role' => 'admin',
            'permissions' => json_encode(['all']),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $operatorId = \Illuminate\Support\Facades\DB::table('users')->insertGetId([
            'name' => 'Production Operator',
            'email' => 'operator@fromagerie.com',
            'password' => \Illuminate\Support\Facades\Hash::make('password'),
            'role' => 'operator',
            'permissions' => json_encode(['production.read', 'production.write']),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // 2. Suppliers
        $supplierId = \Illuminate\Support\Facades\DB::table('suppliers')->insertGetId([
            'name' => 'Ferme Laitière Locale',
            'contact' => 'Jean Michel',
            'email' => 'contact@fermelaitiere.fr',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // 3. Inventory Items
        $milkId = \Illuminate\Support\Facades\DB::table('inventory_items')->insertGetId([
            'name' => 'Raw Cow Milk',
            'type' => 'raw',
            'quantity' => 1000.0,
            'unit' => 'L',
            'price' => 0.45,
            'supplier_id' => $supplierId,
            'min_stock' => 200.0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $cultureId = \Illuminate\Support\Facades\DB::table('inventory_items')->insertGetId([
            'name' => 'Mesophilic Culture',
            'type' => 'raw',
            'quantity' => 500.0,
            'unit' => 'g',
            'price' => 15.00,
            'supplier_id' => $supplierId,
            'min_stock' => 100.0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $rennetId = \Illuminate\Support\Facades\DB::table('inventory_items')->insertGetId([
            'name' => 'Liquid Rennet',
            'type' => 'raw',
            'quantity' => 2000.0,
            'unit' => 'ml',
            'price' => 25.00,
            'supplier_id' => $supplierId,
            'min_stock' => 500.0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // 4. Recipes
        $recipeId = \Illuminate\Support\Facades\DB::table('recipes')->insertGetId([
            'name' => 'Classic Tomme',
            'description' => 'A traditional semi-hard cheese recipe.',
            'yield' => 10.0,
            'yield_unit' => 'kg',
            'version' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // 5. Recipe Ingredients
        \Illuminate\Support\Facades\DB::table('recipe_ingredients')->insert([
            [
                'recipe_id' => $recipeId,
                'material_id' => $milkId,
                'material_name' => 'Raw Cow Milk',
                'quantity' => 100.0,
                'unit' => 'L',
                'unit_price' => 0.45,
            ],
            [
                'recipe_id' => $recipeId,
                'material_id' => $cultureId,
                'material_name' => 'Mesophilic Culture',
                'quantity' => 10.0,
                'unit' => 'g',
                'unit_price' => 15.00,
            ],
            [
                'recipe_id' => $recipeId,
                'material_id' => $rennetId,
                'material_name' => 'Liquid Rennet',
                'quantity' => 25.0,
                'unit' => 'ml',
                'unit_price' => 25.00,
            ],
        ]);
    }
}
