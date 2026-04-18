<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Resets inventory_items quantities to the exact stock_kg values from bakery.sql.
 * The legacy stock_kg already reflects stock AFTER all historical batches, so we
 * write those values as-is — no batch deductions applied.
 *
 * Safe to run multiple times.
 *
 * Run with:
 *   php artisan db:seed --class=SyncInventoryFromLegacySeeder
 */
class SyncInventoryFromLegacySeeder extends Seeder
{
    public function run(): void
    {
        $sqlPath = base_path('sql_to_migrate/bakery.sql');
        if (!file_exists($sqlPath)) {
            $this->command->error("bakery.sql not found at: {$sqlPath}");
            return;
        }

        DB::statement('DROP TABLE IF EXISTS `_sync_ingredients`');
        DB::statement('CREATE TABLE _sync_ingredients (
            id INT, name VARCHAR(255) COLLATE utf8mb4_unicode_ci,
            stock_kg DECIMAL(10,3), low_stock DECIMAL(10,3),
            lot VARCHAR(255) COLLATE utf8mb4_unicode_ci,
            created_at DATETIME, updated_at DATETIME,
            code VARCHAR(10) COLLATE utf8mb4_unicode_ci,
            price_per_kg DECIMAL(10,2), date_added DATE
        ) COLLATE utf8mb4_unicode_ci');

        try {
            $this->command->info('Loading ingredients from bakery.sql into staging table...');
            $this->loadIngredientsInsert($sqlPath);

            $count = DB::table('_sync_ingredients')->count();
            $this->command->info("Staged {$count} ingredient rows.");

            // Direct UPDATE: match inventory_items by name+lot, set quantity = stock_kg
            $affected = DB::statement("
                UPDATE inventory_items ii
                JOIN _sync_ingredients si
                    ON TRIM(ii.name) = TRIM(si.name)
                   AND ii.lot        = si.lot
                SET
                    ii.quantity   = si.stock_kg,
                    ii.min_stock  = si.low_stock,
                    ii.status     = CASE
                        WHEN si.stock_kg <= 0                               THEN 'out'
                        WHEN si.low_stock > 0 AND si.stock_kg <= si.low_stock THEN 'low'
                        ELSE 'ok'
                    END,
                    ii.updated_at = NOW()
            ");

            // Count how many were actually matched and updated
            $matched = DB::select("
                SELECT COUNT(*) as cnt
                FROM inventory_items ii
                JOIN _sync_ingredients si
                    ON TRIM(ii.name) = TRIM(si.name)
                   AND ii.lot        = si.lot
            ");
            $matched = $matched[0]->cnt ?? 0;

            $this->command->info("Done. {$matched} inventory item(s) synced to bakery.sql quantities.");

            // Clear all history for these items — the reset is a clean slate,
            // not a user-initiated change, so history should not show it.
            $matchedIds = DB::select("
                SELECT ii.id
                FROM inventory_items ii
                JOIN _sync_ingredients si
                    ON TRIM(ii.name) = TRIM(si.name)
                   AND ii.lot        = si.lot
            ");
            $ids = array_column($matchedIds, 'id');
            if (!empty($ids)) {
                $deleted = DB::table('inventory_history')->whereIn('item_id', $ids)->delete();
                $this->command->info("Cleared {$deleted} history record(s) for synced items.");
            }

            $unmatched = DB::select("
                SELECT si.name, si.lot, si.stock_kg
                FROM _sync_ingredients si
                LEFT JOIN inventory_items ii
                    ON TRIM(ii.name) = TRIM(si.name)
                   AND ii.lot        = si.lot
                WHERE ii.id IS NULL
            ");
            if (!empty($unmatched)) {
                $this->command->warn(count($unmatched) . ' legacy ingredient(s) not found in inventory_items (no match on name+lot):');
                foreach ($unmatched as $row) {
                    $this->command->line("  - {$row->name} (lot: {$row->lot}, stock_kg: {$row->stock_kg})");
                }
            }
        } finally {
            DB::statement('DROP TABLE IF EXISTS `_sync_ingredients`');
        }
    }

    private function loadIngredientsInsert(string $path): void
    {
        $lines     = file($path, FILE_IGNORE_NEW_LINES);
        $buffer    = '';
        $capturing = false;

        foreach ($lines as $line) {
            if (!$capturing) {
                if (str_starts_with($line, "INSERT INTO `ingredients`")) {
                    $line      = str_replace('`ingredients`', '`_sync_ingredients`', $line);
                    $capturing = true;
                    $buffer    = $line . "\n";
                }
                continue;
            }

            $buffer .= $line . "\n";

            if (str_ends_with(trim($line), ';')) {
                DB::unprepared($buffer);
                break;
            }
        }
    }
}
