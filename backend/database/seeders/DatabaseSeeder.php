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
        // 1. Users (emails match Login page demo accounts)
        \App\Models\User::updateOrCreate(
            ['email' => 'marie@fromagerie.com'],
            [
                'name' => 'Marie Laurent',
                'password' => \Illuminate\Support\Facades\Hash::make('password'),
                'role' => 'admin',
                'permissions' => json_encode([]),
            ]
        );

        // 2. Permissions
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
            'analytics.read',
        ];

        foreach ($permissions as $p) {
            \Illuminate\Support\Facades\DB::table('permissions')->updateOrInsert(
                ['name' => $p],
                ['created_at' => now(), 'updated_at' => now()]
            );
        }

        \App\Models\User::updateOrCreate(
            ['email' => 'jean@fromagerie.com'],
            [
                'name' => 'Jean Dupont',
                'password' => \Illuminate\Support\Facades\Hash::make('password'),
                'role' => 'supervisor',
                'permissions' => json_encode([
                    'analytics.read',
                    'inventory.read',
                    'recipes.read',
                    'batches.read', 'batches.write',
                    'quality.read', 'quality.write',
                    'users.read',
                ]),
            ]
        );

        \App\Models\User::updateOrCreate(
            ['email' => 'sophie@fromagerie.com'],
            [
                'name' => 'Sophie Martin',
                'password' => \Illuminate\Support\Facades\Hash::make('password'),
                'role' => 'operator',
                'permissions' => json_encode([
                    'inventory.read', 'inventory.write',
                    'recipes.read',
                    'batches.read', 'batches.write',
                ]),
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
                'target_weight' => 10.0,
                'piece_weight' => '500g',
                'recipe_status' => 'final',
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

        // 6. Demo Customers
        $customer1 = \App\Models\Customer::updateOrCreate(
            ['email' => 'dupont.fromagerie@example.com'],
            ['name' => 'Boulangerie Dupont', 'phone' => '01 23 45 67 89', 'address' => '12 Rue du Marché, Lyon']
        );
        $customer2 = \App\Models\Customer::updateOrCreate(
            ['email' => 'restaurant.lepetit@example.com'],
            ['name' => 'Restaurant Le Petit Bistro', 'phone' => '04 56 78 90 12', 'address' => '5 Place de la République, Grenoble']
        );

        // 7. Demo Orders (only if none exist yet)
        if (\App\Models\Order::count() === 0) {
            $order1 = \App\Models\Order::create([
                'customer_id'   => $customer1->id,
                'customer_name' => $customer1->name,
                'total_amount'  => 250.00,
                'amount_paid'   => 250.00,
                'amount_returned' => 0,
                'status'        => 'paid',
                'paid_at'       => now()->subDays(5),
            ]);
            $order1->items()->createMany([
                ['product_name' => 'Classic Tomme 500g', 'quantity' => 10, 'unit_price' => 15.00, 'total' => 150.00],
                ['product_name' => 'Chèvre frais 200g',  'quantity' => 20, 'unit_price' => 5.00,  'total' => 100.00],
            ]);

            $order2 = \App\Models\Order::create([
                'customer_id'   => $customer2->id,
                'customer_name' => $customer2->name,
                'total_amount'  => 180.00,
                'amount_paid'   => 100.00,
                'amount_returned' => 0,
                'status'        => 'partial',
                'paid_at'       => null,
            ]);
            $order2->items()->createMany([
                ['product_name' => 'Classic Tomme 500g', 'quantity' => 8, 'unit_price' => 15.00, 'total' => 120.00],
                ['product_name' => 'Camembert 250g',     'quantity' => 12, 'unit_price' => 5.00,  'total' => 60.00],
            ]);
        }
    }
}
