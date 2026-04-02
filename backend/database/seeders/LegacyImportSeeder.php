<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * One-time migration of the legacy bakery.sql into the current schema.
 * Safe to run multiple times — idempotency guard prevents any duplicate data.
 *
 * Run with:
 *   php artisan db:seed --class=LegacyImportSeeder
 */
class LegacyImportSeeder extends Seeder
{
    // ── Entry point ──────────────────────────────────────────────────────────

    public function run(): void
    {
        // Idempotency: a distinctive ingredient (Purity, lot vhq-10) that only
        // exists in the legacy dataset is the guard.
        if (\App\Models\InventoryItem::where('lot', 'vhq-10')
                ->where('name', 'Purity')->exists()) {
            $this->command->info('Legacy bakery data already imported — skipping.');
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

            $this->command->info('Migrating ingredients → inventory_items...');
            $ingMap = $this->migrateIngredients();

            $this->command->info('Migrating recipes...');
            $recipeMap = $this->migrateRecipes();

            $this->command->info('Migrating recipe ingredients...');
            $this->migrateRecipeIngredients($ingMap, $recipeMap);

            $this->command->info('Migrating batch groups and individual batches...');
            $this->migrateBatches($ingMap, $recipeMap);

            $this->command->info('✓ Legacy import complete.');
        } finally {
            $this->dropStagingTables();
        }
    }

    // ── Staging tables ───────────────────────────────────────────────────────

    private function createStagingTables(): void
    {
        $this->dropStagingTables();

        DB::statement('CREATE TABLE _leg_ingredients (
            id INT, name VARCHAR(255), stock_kg DECIMAL(10,3), low_stock DECIMAL(10,3),
            lot VARCHAR(255), created_at DATETIME, updated_at DATETIME,
            code VARCHAR(10), price_per_kg DECIMAL(10,2), date_added DATE
        )');

        DB::statement('CREATE TABLE _leg_recipes (
            id INT, name VARCHAR(255), code_plat VARCHAR(100),
            created_at DATETIME, updated_at DATETIME,
            piece_weight DECIMAL(10,3), batch_target_weight DECIMAL(10,3),
            product_type VARCHAR(20)
        )');

        DB::statement('CREATE TABLE _leg_recipe_ingredients (
            id INT, recipe_id INT, ingredient_id INT, amount_kg DECIMAL(10,3)
        )');

        DB::statement('CREATE TABLE _leg_batches (
            id INT, recipe_id INT, batch_count INT, date DATE,
            formula VARCHAR(255), code_plat VARCHAR(100), created_at DATETIME,
            loss_percent DECIMAL(5,2), pieces_produced INT,
            leftovers_kg DECIMAL(10,3), inventory_type VARCHAR(20)
        )');

        DB::statement('CREATE TABLE _leg_batch_ingredients (
            id INT, batch_id INT, ingredient_id INT,
            batch_number INT, amount_kg DECIMAL(10,3), lot TEXT
        )');
    }

    private function dropStagingTables(): void
    {
        foreach (['_leg_batch_ingredients','_leg_batches','_leg_recipe_ingredients','_leg_recipes','_leg_ingredients'] as $t) {
            DB::statement("DROP TABLE IF EXISTS `{$t}`");
        }
    }

    // ── SQL parsing ──────────────────────────────────────────────────────────

    /**
     * Extract INSERT statements from bakery.sql, remap table names to _leg_*,
     * and execute them against the staging tables.
     */
    private function loadInserts(string $path): void
    {
        $map = [
            'ingredients'        => '_leg_ingredients',
            'recipes'            => '_leg_recipes',
            'recipe_ingredients' => '_leg_recipe_ingredients',
            'batches'            => '_leg_batches',
            'batch_ingredients'  => '_leg_batch_ingredients',
        ];

        $lines     = file($path, FILE_IGNORE_NEW_LINES);
        $buffer    = '';
        $capturing = false;

        foreach ($lines as $line) {
            // Detect the start of a relevant INSERT statement
            if (!$capturing) {
                foreach ($map as $old => $new) {
                    if (str_starts_with($line, "INSERT INTO `{$old}`")) {
                        $line       = str_replace("`{$old}`", "`{$new}`", $line);
                        $capturing  = true;
                        $buffer     = $line . "\n";
                        break;
                    }
                }
                continue;
            }

            // Accumulate lines until the statement terminator
            $buffer .= $line . "\n";

            if (str_ends_with(trim($line), ';')) {
                DB::unprepared($buffer);
                $buffer    = '';
                $capturing = false;
            }
        }
    }

    // ── Migration steps ──────────────────────────────────────────────────────

    /** @return array<int,int>  old_ingredient_id => new_inventory_item_id */
    private function migrateIngredients(): array
    {
        $map  = [];
        $rows = DB::table('_leg_ingredients')->get();

        foreach ($rows as $row) {
            $qty    = (float) $row->stock_kg;
            $min    = (float) $row->low_stock;
            $status = $qty <= 0 ? 'out' : ($min > 0 && $qty <= $min ? 'low' : 'ok');

            $item = \App\Models\InventoryItem::firstOrCreate(
                ['name' => trim($row->name), 'lot' => $row->lot],
                [
                    'type'        => 'raw',
                    'quantity'    => $qty,
                    'unit'        => 'kg',
                    'price'       => (float) $row->price_per_kg,
                    'code'        => $row->code,
                    'min_stock'   => $min,
                    'status'      => $status,
                    'supplier_id' => null,
                    'created_at'  => $row->created_at,
                    'updated_at'  => $row->updated_at,
                ]
            );

            $map[(int) $row->id] = $item->id;
        }

        return $map;
    }

    /** @return array<int,int>  old_recipe_id => new_recipe_id */
    private function migrateRecipes(): array
    {
        $map  = [];
        $rows = DB::table('_leg_recipes')->get();

        foreach ($rows as $row) {
            // Convert decimal piece_weight (e.g. 1.800) to string "1.8kg"
            $pw = $row->piece_weight
                ? rtrim(rtrim(number_format((float)$row->piece_weight, 3), '0'), '.') . 'kg'
                : '1kg';

            $status = $row->product_type === 'final' ? 'final' : 'semi_final';

            $recipe = \App\Models\Recipe::firstOrCreate(
                ['name' => trim($row->name), 'description' => $row->code_plat],
                [
                    'target_weight' => (float) ($row->batch_target_weight ?? 0),
                    'piece_weight'  => $pw,
                    'recipe_status' => $status,
                    'steps'         => [],
                    'version'       => 1,
                    'created_at'    => $row->created_at,
                    'updated_at'    => $row->updated_at,
                ]
            );

            $map[(int) $row->id] = $recipe->id;
        }

        return $map;
    }

    private function migrateRecipeIngredients(array $ingMap, array $recipeMap): void
    {
        $rows = DB::table('_leg_recipe_ingredients')->get();

        foreach ($rows as $row) {
            $newRecipeId = $recipeMap[(int) $row->recipe_id] ?? null;
            $newIngId    = $ingMap[(int) $row->ingredient_id] ?? null;

            if (!$newRecipeId || !$newIngId) continue;

            // Skip if this link already exists
            $exists = DB::table('recipe_ingredients')
                ->where('recipe_id', $newRecipeId)
                ->where('material_id', $newIngId)
                ->exists();

            if ($exists) continue;

            $ing = DB::table('_leg_ingredients')
                ->where('id', $row->ingredient_id)->first();

            DB::table('recipe_ingredients')->insert([
                'recipe_id'     => $newRecipeId,
                'material_id'   => $newIngId,
                'material_name' => $ing ? trim($ing->name) : 'Unknown',
                'quantity'      => (float) $row->amount_kg,
                'unit'          => 'kg',
                'unit_price'    => $ing ? (float) $ing->price_per_kg : 0,
            ]);
        }
    }

    private function migrateBatches(array $ingMap, array $recipeMap): void
    {
        $legacyBatches = DB::table('_leg_batches')->get();

        // Pre-fetch all batch_ingredients grouped by (batch_id, batch_number)
        $allBatchIngs = DB::table('_leg_batch_ingredients')
            ->orderBy('batch_id')->orderBy('batch_number')
            ->get()
            ->groupBy(fn($r) => $r->batch_id . '_' . $r->batch_number);

        foreach ($legacyBatches as $lb) {
            $newRecipeId = $recipeMap[(int) $lb->recipe_id] ?? null;
            $recipe      = $newRecipeId
                ? \App\Models\Recipe::find($newRecipeId)
                : null;

            // ── Create (or find) the batch group ────────────────────────────
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
                    'leftover_unit'      => $lb->leftovers_kg > 0 ? 'kg' : null,
                    'created_by'         => 'Legacy Import',
                    'updated_at'         => $lb->created_at,
                ]
            );

            // Skip individual batch rows if already created for this group
            if (\App\Models\Batch::where('batch_group_id', $group->id)->exists()) {
                continue;
            }

            // ── Create one Batch row per batch_number ────────────────────────
            for ($batchNum = 1; $batchNum <= (int) $lb->batch_count; $batchNum++) {
                $key  = $lb->id . '_' . $batchNum;
                $ings = $allBatchIngs->get($key, collect());

                $inputMaterials = $ings->map(function ($row) use ($ingMap) {
                    $legIng = DB::table('_leg_ingredients')
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
                    ? (int) round($lb->pieces_produced / max($lb->batch_count, 1))
                    : 0;

                \App\Models\Batch::create([
                    'recipe_id'      => $newRecipeId,
                    'recipe_name'    => trim($lb->formula),
                    'batch_group_id' => $group->id,
                    'status'         => 'completed',
                    'input_materials'=> $inputMaterials,
                    'output_quantity'=> $perBatchOutput,
                    'output_unit'    => 'pcs',
                    'operator_id'    => null,
                    'operator_name'  => 'Legacy Import',
                    'started_at'     => $lb->date,
                    'completed_at'   => $lb->date,
                    'created_at'     => $lb->created_at,
                    'updated_at'     => $lb->created_at,
                ]);
            }
        }
    }
}
