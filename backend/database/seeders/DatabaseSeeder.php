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
        $admin = \App\Models\User::updateOrCreate(
            ['email' => 'admin@fromagerie.com'],
            [
                'name' => 'Admin User',
                'password' => \Illuminate\Support\Facades\Hash::make('password'),
                'role' => 'admin',
                // Keep permissions array since model casts to json or handles it
                'permissions' => json_encode(['all']),
            ]
        );

        $operator = \App\Models\User::updateOrCreate(
            ['email' => 'operator@fromagerie.com'],
            [
                'name' => 'Production Operator',
                'password' => \Illuminate\Support\Facades\Hash::make('password'),
                'role' => 'operator',
                'permissions' => json_encode(['production.read', 'production.write']),
            ]
        );

        // 2. Suppliers
        $supplier = \Illuminate\Support\Facades\DB::table('suppliers')->where('email', 'contact@fermelaitiere.fr')->first();
        if (!$supplier) {
            $supplierId = \Illuminate\Support\Facades\DB::table('suppliers')->insertGetId([
                'name' => 'Ferme Laitière Locale',
                'contact' => 'Jean Michel',
                'email' => 'contact@fermelaitiere.fr',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } else {
            $supplierId = $supplier->id;
            \Illuminate\Support\Facades\DB::table('suppliers')->where('id', $supplierId)->update([
                'name' => 'Ferme Laitière Locale',
                'contact' => 'Jean Michel',
                'updated_at' => now(),
            ]);
        }

        // 3. Inventory Items
        $milk = \App\Models\InventoryItem::updateOrCreate(
            ['name' => 'Raw Cow Milk'],
            [
                'type' => 'raw',
                'quantity' => 1000.0,
                'unit' => 'L',
                'price' => 0.45,
                'supplier_id' => $supplierId,
                'min_stock' => 200.0,
            ]
        );

        $culture = \App\Models\InventoryItem::updateOrCreate(
            ['name' => 'Mesophilic Culture'],
            [
                'type' => 'raw',
                'quantity' => 500.0,
                'unit' => 'g',
                'price' => 15.00,
                'supplier_id' => $supplierId,
                'min_stock' => 100.0,
            ]
        );

        $rennet = \App\Models\InventoryItem::updateOrCreate(
            ['name' => 'Liquid Rennet'],
            [
                'type' => 'raw',
                'quantity' => 2000.0,
                'unit' => 'ml',
                'price' => 25.00,
                'supplier_id' => $supplierId,
                'min_stock' => 500.0,
            ]
        );

        // 4. Recipes
        $recipe = \App\Models\Recipe::updateOrCreate(
            ['name' => 'Classic Tomme'],
            [
                'description' => 'A traditional semi-hard cheese recipe.',
                'yield' => 10.0,
                'yield_unit' => 'kg',
                'version' => 1,
            ]
        );

        // 5. Recipe Ingredients
        \Illuminate\Support\Facades\DB::table('recipe_ingredients')->where('recipe_id', $recipe->id)->delete();
        \Illuminate\Support\Facades\DB::table('recipe_ingredients')->insert([
            [
                'recipe_id' => $recipe->id,
                'material_id' => $milk->id,
                'material_name' => 'Raw Cow Milk',
                'quantity' => 100.0,
                'unit' => 'L',
                'unit_price' => 0.45,
            ],
            [
                'recipe_id' => $recipe->id,
                'material_id' => $culture->id,
                'material_name' => 'Mesophilic Culture',
                'quantity' => 10.0,
                'unit' => 'g',
                'unit_price' => 15.00,
            ],
            [
                'recipe_id' => $recipe->id,
                'material_id' => $rennet->id,
                'material_name' => 'Liquid Rennet',
                'quantity' => 25.0,
                'unit' => 'ml',
                'unit_price' => 25.00,
            ],
        ]);
    }
}
