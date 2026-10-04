<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Syncs a phpMyAdmin dump of the legacy bakery app (ingredients, recipes, batches)
 * into the current schema. Safe to re-run: every row is matched before insert.
 *
 * - The legacy app is treated as the source of truth for the rows it contains.
 * - Each ingredient lot stays its own inventory item (lot lives on the item).
 * - Orphan batch rows (no parent batch) and duplicated ingredient lines are dropped.
 * - Writes go through the query builder, so observers (stock deduction, history,
 *   notifications) never fire for historical data.
 *
 *   php artisan legacy:import sql_to_migrate/bakery.sql --dry-run
 *   php artisan legacy:import sql_to_migrate/bakery.sql
 */
class ImportLegacyBakery extends Command
{
    protected $signature = 'legacy:import
        {file=sql_to_migrate/bakery.sql : Path to the legacy SQL dump (absolute or relative to backend/)}
        {--dry-run : Run everything, print the report, then roll back}
        {--no-stock : Do not overwrite quantities of inventory items that already exist}';

    protected $description = 'Import/sync legacy bakery ingredients, recipes and batches';

    private const PREFIX = '_legsync_';
    private const TABLES = ['ingredients', 'recipes', 'recipe_ingredients', 'batches', 'batch_ingredients'];
    private const IMPORT_AUTHOR = 'Legacy Import';

    private array $report = [];

    public function handle(): int
    {
        $path = $this->argument('file');
        if (!str_starts_with($path, '/') && !preg_match('/^[A-Za-z]:[\\\\\/]/', $path)) {
            $path = base_path($path);
        }
        if (!is_file($path)) {
            $this->error("Dump not found: {$path}");
            return self::FAILURE;
        }
        if (!Schema::hasColumn('batch_groups', 'legacy_id')) {
            $this->error('Run `php artisan migrate` first (batch_groups.legacy_id is missing).');
            return self::FAILURE;
        }
        $operatorId = DB::table('users')->orderBy('id')->value('id');
        if (!$operatorId) {
            $this->error('No user exists to attribute imported batches to.');
            return self::FAILURE;
        }

        // DDL commits implicitly in MySQL, so staging happens before the transaction
        $this->createStaging();
        try {
            $this->loadDump($path);
            $this->cleanStaging();

            DB::beginTransaction();
            try {
                $ingMap    = $this->syncIngredients();
                $recipeMap = $this->syncRecipes($ingMap);
                $this->syncBatches($ingMap, $recipeMap, $operatorId);

                if ($this->option('dry-run')) {
                    DB::rollBack();
                } else {
                    DB::commit();
                }
            } catch (\Throwable $e) {
                DB::rollBack();
                throw $e;
            }
        } finally {
            $this->dropStaging();
        }

        $this->table(['Step', 'Count'], collect($this->report)->map(fn($v, $k) => [$k, $v])->values()->all());
        $this->info($this->option('dry-run') ? 'Dry run — nothing was saved.' : 'Import committed.');
        return self::SUCCESS;
    }

    // ── Staging ──────────────────────────────────────────────────────────────

    private function createStaging(): void
    {
        $this->dropStaging();
        $c = 'COLLATE utf8mb4_unicode_ci';
        $p = self::PREFIX;
        DB::statement("CREATE TABLE {$p}ingredients (id INT, name VARCHAR(255) {$c}, stock_kg DECIMAL(10,3), low_stock DECIMAL(10,3),
            lot VARCHAR(255) {$c}, created_at DATETIME NULL, updated_at DATETIME NULL, code VARCHAR(10) {$c},
            price_per_kg DECIMAL(10,2), date_added DATE NULL) {$c}");
        DB::statement("CREATE TABLE {$p}recipes (id INT, name VARCHAR(255) {$c}, code_plat VARCHAR(100) {$c},
            created_at DATETIME NULL, updated_at DATETIME NULL, piece_weight DECIMAL(10,3) NULL,
            batch_target_weight DECIMAL(10,3) NULL, product_type VARCHAR(20) {$c} NULL) {$c}");
        DB::statement("CREATE TABLE {$p}recipe_ingredients (id INT, recipe_id INT, ingredient_id INT, amount_kg DECIMAL(10,3))");
        DB::statement("CREATE TABLE {$p}batches (id INT, recipe_id INT, batch_count INT, date DATE, formula VARCHAR(255) {$c},
            code_plat VARCHAR(100) {$c}, created_at DATETIME NULL, loss_percent DECIMAL(5,2) NULL, pieces_produced INT NULL,
            leftovers_kg DECIMAL(10,3) NULL, inventory_type VARCHAR(20) {$c} NULL) {$c}");
        DB::statement("CREATE TABLE {$p}batch_ingredients (id INT, batch_id INT, ingredient_id INT, batch_number INT,
            amount_kg DECIMAL(10,3), lot TEXT {$c}) {$c}");
    }

    private function dropStaging(): void
    {
        foreach (self::TABLES as $t) {
            DB::statement('DROP TABLE IF EXISTS `' . self::PREFIX . $t . '`');
        }
    }

    /** Replays the dump's INSERT statements for the five legacy tables into the staging tables. */
    private function loadDump(string $path): void
    {
        $handle = fopen($path, 'r');
        $buffer = '';
        $capturing = false;

        while (($line = fgets($handle)) !== false) {
            if (!$capturing) {
                foreach (self::TABLES as $t) {
                    $needle = "INSERT INTO `{$t}` ";
                    if (str_starts_with(ltrim($line), $needle)) {
                        $buffer = str_replace($needle, 'INSERT INTO `' . self::PREFIX . "{$t}` ", $line);
                        $capturing = true;
                        break;
                    }
                }
            } else {
                $buffer .= $line;
            }

            if ($capturing && str_ends_with(rtrim($line), ';')) {
                DB::unprepared($buffer);
                $buffer = '';
                $capturing = false;
            }
        }
        fclose($handle);

        foreach (self::TABLES as $t) {
            $this->report["Legacy {$t} rows"] = DB::table(self::PREFIX . $t)->count();
        }
    }

    private function cleanStaging(): void
    {
        $p = self::PREFIX;
        $this->report['Dropped: orphan batch ingredient rows'] = DB::delete(
            "DELETE bi FROM {$p}batch_ingredients bi LEFT JOIN {$p}batches b ON b.id = bi.batch_id WHERE b.id IS NULL"
        );
    }

    // ── Ingredients → inventory_items ────────────────────────────────────────

    /** @return array<int,int> legacy ingredient id => inventory_items.id */
    private function syncIngredients(): array
    {
        $map = [];
        $created = $updated = $skipped = 0;
        $keepStock = $this->option('no-stock');

        foreach (DB::table(self::PREFIX . 'ingredients')->orderBy('id')->get() as $row) {
            $name = trim((string) $row->name);
            if ($name === '') {
                $skipped++;
                continue;
            }
            $lot = trim((string) $row->lot);
            $qty = (float) $row->stock_kg;
            $min = (float) $row->low_stock;

            // The legacy app stored leftover pâte as "Leftovers_<recipe>_<date>" ingredients
            $type = str_starts_with($name, 'Leftovers_') ? 'leftover' : 'raw';
            $existing = $this->findRawItem($name, $lot, $type);
            $values = [
                'price'      => (float) $row->price_per_kg,
                'code'       => $row->code ?: null,
                'min_stock'  => $min,
                'updated_at' => now(),
            ];

            if ($existing) {
                if (!$keepStock) {
                    $values['quantity'] = $qty;
                }
                $values['status'] = $this->stockStatus($values['quantity'] ?? (float) $existing->quantity, $min);
                DB::table('inventory_items')->where('id', $existing->id)->update($values);
                $map[(int) $row->id] = $existing->id;
                $updated++;
            } else {
                $map[(int) $row->id] = DB::table('inventory_items')->insertGetId($values + [
                    'name'        => $name,
                    'type'        => $type,
                    'quantity'    => $qty,
                    'unit'        => 'kg',
                    'lot'         => $lot,
                    'supplier_id' => null,
                    'status'      => $this->stockStatus($qty, $min),
                    'created_at'  => $row->created_at ?? now(),
                ]);
                $created++;
            }
        }

        $this->report['Inventory items created'] = $created;
        $this->report['Inventory items updated' . ($keepStock ? ' (stock kept)' : '')] = $updated;
        $this->report['Skipped: ingredients without a name'] = $skipped;
        return $map;
    }

    private function findRawItem(string $name, string $lot, string $type = 'raw'): ?object
    {
        return DB::table('inventory_items')
            ->where('type', $type)
            ->whereRaw('TRIM(name) = ?', [$name])
            ->where(fn($q) => $lot === ''
                ? $q->whereNull('lot')->orWhere('lot', '')
                : $q->where('lot', $lot))
            ->orderBy('id')
            ->first();
    }

    private function stockStatus(float $qty, float $min): string
    {
        // Mirrors InventoryItem::booted()
        if ($qty <= 0) return 'out';
        if ($min > 0 && $qty <= $min) return 'low';
        return 'ok';
    }

    // ── Recipes ──────────────────────────────────────────────────────────────

    /** @return array<int,int> legacy recipe id => recipes.id */
    private function syncRecipes(array $ingMap): array
    {
        $map = [];
        $created = $updated = $linesReplaced = 0;
        $legacyIngs = DB::table(self::PREFIX . 'ingredients')->get()->keyBy('id');
        $legacyLines = DB::table(self::PREFIX . 'recipe_ingredients')->get()->groupBy('recipe_id');

        foreach (DB::table(self::PREFIX . 'recipes')->orderBy('id')->get() as $row) {
            $name = trim((string) $row->name);
            $code = trim((string) $row->code_plat);
            $fields = [
                'target_weight' => (float) ($row->batch_target_weight ?? 0),
                'piece_weight'  => $this->formatWeight($row->piece_weight),
                'recipe_status' => $row->product_type === 'final' ? 'final' : 'semi_final',
            ];

            // Includes soft-deleted recipes so a recipe removed in the new app is not recreated
            $existing = DB::table('recipes')->whereRaw('TRIM(name) = ?', [$name])->where('description', $code)->orderBy('id')->first();

            if ($existing) {
                $recipeId = $existing->id;
                $changed = (float) $existing->target_weight !== $fields['target_weight']
                    || $existing->piece_weight !== $fields['piece_weight']
                    || $existing->recipe_status !== $fields['recipe_status'];
                if ($changed) {
                    DB::table('recipes')->where('id', $recipeId)->update($fields + ['updated_at' => now()]);
                    $updated++;
                }
            } else {
                $recipeId = DB::table('recipes')->insertGetId($fields + [
                    'name'        => $name,
                    'description' => $code,
                    'version'     => 1,
                    'created_at'  => $row->created_at ?? now(),
                    'updated_at'  => $row->updated_at ?? now(),
                ]);
                $created++;
            }
            $map[(int) $row->id] = $recipeId;

            $lines = collect($legacyLines->get($row->id, []))
                ->filter(fn($l) => isset($ingMap[(int) $l->ingredient_id]))
                ->map(fn($l) => [
                    'recipe_id'     => $recipeId,
                    'material_id'   => $ingMap[(int) $l->ingredient_id],
                    'material_name' => trim($legacyIngs[$l->ingredient_id]->name),
                    'quantity'      => round((float) $l->amount_kg, 3),
                    'unit'          => 'kg',
                    'unit_price'    => (float) $legacyIngs[$l->ingredient_id]->price_per_kg,
                ])
                ->sortBy('material_id')->values();

            $current = DB::table('recipe_ingredients')->where('recipe_id', $recipeId)->orderBy('material_id')->get()
                ->map(fn($l) => [(int) $l->material_id, round((float) $l->quantity, 3)])->all();
            $incoming = $lines->map(fn($l) => [$l['material_id'], $l['quantity']])->all();

            if ($lines->isNotEmpty() && $current !== $incoming) {
                DB::table('recipe_ingredients')->where('recipe_id', $recipeId)->delete();
                DB::table('recipe_ingredients')->insert($lines->all());
                $linesReplaced++;
            }
        }

        $this->report['Recipes created'] = $created;
        $this->report['Recipes updated'] = $updated;
        $this->report['Recipe ingredient lists replaced'] = $linesReplaced;
        return $map;
    }

    /** 1.800 → "1.8kg" (same format the Recipes page writes) */
    private function formatWeight($kg): string
    {
        $kg = (float) $kg;
        return rtrim(rtrim(number_format($kg, 3, '.', ''), '0'), '.') . 'kg';
    }

    // ── Batches → batch_groups + batches ─────────────────────────────────────

    private function syncBatches(array $ingMap, array $recipeMap, int $operatorId): void
    {
        $created = $alreadyThere = $linked = $mixes = $dupLines = $zeroLines = $noRecipe = 0;
        $itemByLot = [];
        $legacyIngs = DB::table(self::PREFIX . 'ingredients')->get()->keyBy('id');
        $legacyRecipes = DB::table(self::PREFIX . 'recipes')->get()->keyBy('id');
        $linesByMix = DB::table(self::PREFIX . 'batch_ingredients')->orderBy('id')->get()
            ->groupBy(fn($r) => $r->batch_id . '_' . $r->batch_number);
        $lotCounters = [];

        foreach (DB::table(self::PREFIX . 'batches')->orderBy('date')->orderBy('id')->get() as $lb) {
            if (DB::table('batch_groups')->where('legacy_id', $lb->id)->exists()) {
                $alreadyThere++;
                continue;
            }
            $recipeId = $recipeMap[(int) $lb->recipe_id] ?? null;
            if (!$recipeId) {
                $noRecipe++;
                continue;
            }
            $recipeName = trim((string) $lb->formula);

            // Groups from the older LegacyBatchImportSeeder have no legacy_id yet: claim them instead of duplicating
            $previous = DB::table('batch_groups as g')
                ->where('g.created_by', self::IMPORT_AUTHOR)->whereNull('g.legacy_id')
                ->whereRaw('TRIM(g.recipe_name) = ?', [$recipeName])
                ->where('g.batch_count', (int) $lb->batch_count)
                ->whereExists(fn($q) => $q->from('batches as b')->whereColumn('b.batch_group_id', 'g.id')->whereDate('b.started_at', $lb->date))
                ->value('g.id');
            if ($previous) {
                DB::table('batch_groups')->where('id', $previous)->update(['legacy_id' => $lb->id]);
                $linked++;
                continue;
            }

            // Since spring the legacy app saved "not filled in" as 0 pieces / -100 % loss
            $recorded = (int) $lb->pieces_produced > 0;
            $legacyRecipe = $legacyRecipes[$lb->recipe_id] ?? null;
            $createdAt = $lb->created_at ?? $lb->date;

            $groupId = DB::table('batch_groups')->insertGetId([
                'legacy_id'          => $lb->id,
                'recipe_id'          => $recipeId,
                'recipe_name'        => $recipeName,
                'batch_count'        => (int) $lb->batch_count,
                'target_weight'      => (float) ($legacyRecipe->batch_target_weight ?? 0),
                'piece_weight_value' => (float) ($legacyRecipe->piece_weight ?? 0),
                'pieces_produced'    => $recorded ? (int) $lb->pieces_produced : null,
                'leftover_qty'       => (float) $lb->leftovers_kg > 0 ? (float) $lb->leftovers_kg : null,
                'leftover_unit'      => 'kg',
                'created_by'         => self::IMPORT_AUTHOR,
                'created_at'         => $createdAt,
                'updated_at'         => $createdAt,
            ]);
            $created++;

            $lotBase = strtoupper(substr(preg_replace('/[^a-zA-Z]/', '', $recipeName), 0, 3)) . '-' . date('dmY', strtotime($lb->date));
            $lotCounters[$lotBase] ??= DB::table('batches')->where('lot', 'like', "{$lotBase}-%")->count();

            for ($n = 1; $n <= (int) $lb->batch_count; $n++) {
                $seen = [];
                $materials = [];
                foreach ($linesByMix->get("{$lb->id}_{$n}", []) as $line) {
                    $ing = $legacyIngs[$line->ingredient_id] ?? null;
                    $name = $ing ? trim($ing->name) : 'Unknown';
                    $lot = trim((string) $line->lot);
                    $amount = round((float) $line->amount_kg, 3);
                    if ($amount <= 0) {
                        $zeroLines++;
                        continue;
                    }

                    // Same material, lot and amount twice in one mix = duplicated legacy row
                    $key = mb_strtolower($name) . '|' . $lot . '|' . $amount;
                    if (isset($seen[$key])) {
                        $dupLines++;
                        continue;
                    }
                    $seen[$key] = true;

                    // Point at the item for the lot actually used, falling back to the ingredient row
                    $lotKey = mb_strtolower($name) . '|' . $lot;
                    if ($lot !== '' && !array_key_exists($lotKey, $itemByLot)) {
                        $itemByLot[$lotKey] = $this->findRawItem($name, $lot)?->id;
                    }
                    $materialId = ($lot !== '' ? $itemByLot[$lotKey] : null)
                        ?? ($ingMap[(int) $line->ingredient_id] ?? null);

                    $materials[] = [
                        'material_id'   => $materialId,
                        'material_name' => $name,
                        'quantity'      => $amount,
                        'unit'          => 'kg',
                        'unit_price'    => $ing ? (float) $ing->price_per_kg : 0,
                        'lot'           => $lot,
                    ];
                }

                $lotCounters[$lotBase]++;
                DB::table('batches')->insert([
                    'recipe_id'       => $recipeId,
                    'batch_group_id'  => $groupId,
                    'recipe_name'     => $recipeName,
                    'lot'             => $lotBase . '-' . str_pad($lotCounters[$lotBase], 3, '0', STR_PAD_LEFT),
                    'status'          => 'completed',
                    'input_materials' => json_encode($materials),
                    'output_quantity' => $recorded ? (int) round($lb->pieces_produced / max(1, (int) $lb->batch_count)) : 0,
                    'output_unit'     => 'pcs',
                    'operator_id'     => $operatorId,
                    'operator_name'   => self::IMPORT_AUTHOR,
                    'started_at'      => $lb->date,
                    'completed_at'    => $lb->date,
                ]);
                $mixes++;
            }
        }

        $this->report['Batch groups created'] = $created;
        $this->report['Batches (mixes) created'] = $mixes;
        $this->report['Batch groups already imported'] = $alreadyThere;
        $this->report['Batch groups linked from older import'] = $linked;
        $this->report['Dropped: duplicated ingredient lines in mixes'] = $dupLines;
        $this->report['Dropped: 0 kg ingredient lines in mixes'] = $zeroLines;
        $this->report['Skipped: batches whose recipe is missing'] = $noRecipe;
    }
}
