<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * One-time import of legacy bakery.sql batch history into batch_groups + batches.
 * Runs AFTER LegacyImportSeeder (ingredients + recipes already exist).
 * Uses withoutEvents() — no inventory deduction, no observers fired.
 *
 * Run with:
 *   php artisan db:seed --class=LegacyBatchImportSeeder
 */
class LegacyBatchImportSeeder extends Seeder
{
    public function run(): void
    {
        if (\App\Models\BatchGroup::where('created_by', 'Legacy Import')->exists()) {
            $this->command->info('Legacy batches already imported — skipping.');
            return;
        }

        $sqlPath = base_path('sql_to_migrate/bakery.sql');
        if (!file_exists($sqlPath)) {
            $this->command->error("bakery.sql not found at: {$sqlPath}");
            return;
        }

        $this->command->info('Creating staging tables...');
        $this->createStagingTables();

        try {
            $this->command->info('Loading legacy SQL data...');
            $this->loadInserts($sqlPath);

            $this->command->info('Building ingredient map...');
            $ingMap = $this->buildIngredientMap();

            $this->command->info('Building recipe map...');
            $recipeMap = $this->buildRecipeMap();

            $this->command->info('Importing batch groups and batches...');
            $this->importBatches($ingMap, $recipeMap);

            $this->command->info('✓ Legacy batch import complete.');
        } finally {
            $this->dropStagingTables();
        }
    }

    private function createStagingTables(): void
    {
        $this->dropStagingTables();

        // Full column set matching bakery.sql INSERT column list exactly
        DB::statement('CREATE TABLE _lb_ingredients (
            id INT, name VARCHAR(255) COLLATE utf8mb4_unicode_ci,
            stock_kg DECIMAL(10,3), low_stock DECIMAL(10,3),
            lot VARCHAR(255) COLLATE utf8mb4_unicode_ci,
            created_at DATETIME, updated_at DATETIME,
            code VARCHAR(10) COLLATE utf8mb4_unicode_ci,
            price_per_kg DECIMAL(10,2), date_added DATE
        ) COLLATE utf8mb4_unicode_ci');

        DB::statement('CREATE TABLE _lb_recipes (
            id INT, name VARCHAR(255) COLLATE utf8mb4_unicode_ci,
            code_plat VARCHAR(100) COLLATE utf8mb4_unicode_ci,
            created_at DATETIME, updated_at DATETIME,
            piece_weight DECIMAL(10,3), batch_target_weight DECIMAL(10,3),
            product_type VARCHAR(20) COLLATE utf8mb4_unicode_ci
        ) COLLATE utf8mb4_unicode_ci');

        DB::statement('CREATE TABLE _lb_batches (
            id INT, recipe_id INT, batch_count INT, date DATE,
            formula VARCHAR(255) COLLATE utf8mb4_unicode_ci,
            code_plat VARCHAR(100) COLLATE utf8mb4_unicode_ci,
            created_at DATETIME, loss_percent DECIMAL(5,2),
            pieces_produced INT, leftovers_kg DECIMAL(10,3),
            inventory_type VARCHAR(20) COLLATE utf8mb4_unicode_ci
        ) COLLATE utf8mb4_unicode_ci');

        DB::statement('CREATE TABLE _lb_batch_ingredients (
            id INT, batch_id INT, ingredient_id INT,
            batch_number INT, amount_kg DECIMAL(10,3),
            lot TEXT COLLATE utf8mb4_unicode_ci
        ) COLLATE utf8mb4_unicode_ci');
    }

    private function dropStagingTables(): void
    {
        foreach (['_lb_batch_ingredients', '_lb_batches', '_lb_recipes', '_lb_ingredients'] as $t) {
            DB::statement("DROP TABLE IF EXISTS `{$t}`");
        }
    }

    private function loadInserts(string $path): void
    {
        $sourceMap = [
            'INSERT INTO `ingredients`'       => 'INSERT IGNORE INTO `_lb_ingredients`',
            'INSERT INTO `recipes`'           => 'INSERT IGNORE INTO `_lb_recipes`',
            'INSERT INTO `batches`'           => 'INSERT IGNORE INTO `_lb_batches`',
            'INSERT INTO `batch_ingredients`' => 'INSERT IGNORE INTO `_lb_batch_ingredients`',
        ];

        $handle = fopen($path, 'r');
        $buffer = '';
        $capturing = false;

        while (($line = fgets($handle)) !== false) {
            $trimmed = ltrim($line);

            if (!$capturing) {
                foreach ($sourceMap as $search => $replace) {
                    if (str_starts_with($trimmed, $search)) {
                        $buffer = str_replace($search, $replace, $line);
                        $capturing = true;
                        break;
                    }
                }
                continue;
            }

            $buffer .= $line;

            if (str_ends_with(trim($line), ';')) {
                DB::unprepared($buffer);
                $buffer = '';
                $capturing = false;
            }
        }

        fclose($handle);
    }

    /** @return array<int,int>  legacy_ingredient_id => inventory_item_id */
    private function buildIngredientMap(): array
    {
        $map  = [];
        $rows = DB::table('_lb_ingredients')->get();

        foreach ($rows as $row) {
            $item = \App\Models\InventoryItem::where('name', trim($row->name))
                ->where('lot', $row->lot)
                ->first();

            // Fallback: match by name only (lot may have been cleared by migrations)
            if (!$item) {
                $item = \App\Models\InventoryItem::where('name', trim($row->name))
                    ->first();
            }

            if ($item) {
                $map[(int) $row->id] = $item->id;
            }
        }

        return $map;
    }

    /** @return array<int,int>  legacy_recipe_id => recipe_id */
    private function buildRecipeMap(): array
    {
        $map  = [];
        $rows = DB::table('_lb_recipes')->get();

        foreach ($rows as $row) {
            $recipe = \App\Models\Recipe::where('name', trim($row->name))
                ->where('description', $row->code_plat)
                ->first();

            if ($recipe) {
                $map[(int) $row->id] = $recipe->id;
            }
        }

        return $map;
    }

    private function importBatches(array $ingMap, array $recipeMap): void
    {
        $legacyBatches = DB::table('_lb_batches')->get();

        $allBatchIngs = DB::table('_lb_batch_ingredients')
            ->orderBy('batch_id')->orderBy('batch_number')
            ->get()
            ->groupBy(fn($r) => $r->batch_id . '_' . $r->batch_number);

        $created = 0;

        foreach ($legacyBatches as $lb) {
            $newRecipeId = $recipeMap[(int) $lb->recipe_id] ?? null;
            $recipe = $newRecipeId ? \App\Models\Recipe::find($newRecipeId) : null;

            $group = \App\Models\BatchGroup::firstOrCreate(
                [
                    'recipe_name' => trim($lb->formula),
                    'created_at'  => $lb->created_at,
                ],
                [
                    'recipe_id'          => $newRecipeId,
                    'batch_count'        => (int) $lb->batch_count,
                    'target_weight'      => $recipe ? (float) $recipe->target_weight : 0,
                    'piece_weight_value' => $recipe
                        ? (float) preg_replace('/[^0-9.]/', '', $recipe->piece_weight)
                        : 0,
                    'pieces_produced'    => $lb->pieces_produced,
                    'leftover_qty'       => $lb->leftovers_kg > 0 ? (float) $lb->leftovers_kg : null,
                    'leftover_unit'      => 'kg',
                    'created_by'         => 'Legacy Import',
                    'updated_at'         => $lb->created_at,
                ]
            );

            if (\App\Models\Batch::where('batch_group_id', $group->id)->exists()) {
                continue;
            }

            for ($batchNum = 1; $batchNum <= (int) $lb->batch_count; $batchNum++) {
                $key  = $lb->id . '_' . $batchNum;
                $ings = $allBatchIngs->get($key, collect());

                $inputMaterials = $ings->map(function ($row) use ($ingMap) {
                    $legIng = DB::table('_lb_ingredients')
                        ->where('id', $row->ingredient_id)->first();

                    return [
                        'material_id'   => $ingMap[(int) $row->ingredient_id] ?? null,
                        'material_name' => $legIng ? trim($legIng->name) : 'Unknown',
                        'quantity'      => (float) $row->amount_kg,
                        'unit'          => 'kg',
                        'unit_price'    => $legIng ? (float) $legIng->price_per_kg : 0,
                    ];
                })->values()->all();

                $perBatchOutput = $lb->pieces_produced
                    ? (int) round($lb->pieces_produced / max((int) $lb->batch_count, 1))
                    : 0;

                \App\Models\Batch::withoutEvents(function () use (
                    $newRecipeId, $lb, $group, $inputMaterials, $perBatchOutput
                ) {
                    \App\Models\Batch::create([
                        'recipe_id'       => $newRecipeId,
                        'recipe_name'     => trim($lb->formula),
                        'batch_group_id'  => $group->id,
                        'status'          => 'completed',
                        'input_materials' => $inputMaterials,
                        'output_quantity' => $perBatchOutput,
                        'output_unit'     => 'pcs',
                        'operator_id'     => 1,
                        'operator_name'   => 'Legacy Import',
                        'started_at'      => $lb->date,
                        'completed_at'    => $lb->date,
                    ]);
                });

                $created++;
            }
        }

        $this->command->info("Created {$created} batch rows across " . \App\Models\BatchGroup::where('created_by', 'Legacy Import')->count() . " batch groups.");
    }
}
