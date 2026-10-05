<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Loads inventory items from a CSV with the header: Type,Name,Code,Lot,Qty,Unit,Price
 * Rows are matched by code (case-insensitive): existing items are updated, others created.
 *
 *   php artisan inventory:import-csv database/data/packaging_2026-10-05.csv --dry-run
 */
class ImportInventoryCsv extends Command
{
    protected $signature = 'inventory:import-csv
        {file : CSV path (absolute or relative to backend/)}
        {--dry-run : Show what would change without saving}';

    protected $description = 'Create or update inventory items from a CSV file';

    // CSV wording → inventory type used by the app
    private const TYPE_MAP = [
        'carton' => 'Case', 'case' => 'Case', 'box' => 'Box',
        'vacuum bag' => 'Vacbag', 'vacbag' => 'Vacbag',
        'label' => 'Label', 'ticket' => 'Ticket', 'wrap' => 'Wrap', 'wax' => 'Wax',
        'raw' => 'raw', 'raw material' => 'raw',
    ];

    public function handle(): int
    {
        $path = $this->argument('file');
        if (!str_starts_with($path, '/') && !preg_match('/^[A-Za-z]:[\\\\\/]/', $path)) {
            $path = base_path($path);
        }
        if (!is_file($path)) {
            $this->error("File not found: {$path}");
            return self::FAILURE;
        }

        $handle = fopen($path, 'r');
        $header = array_map(fn($h) => strtolower(trim($h, " \t\n\r\0\x0B\xEF\xBB\xBF")), fgetcsv($handle));
        $rows = [];
        while (($cols = fgetcsv($handle)) !== false) {
            if (count(array_filter($cols, fn($c) => trim((string) $c) !== '')) === 0) continue;
            $rows[] = array_combine($header, array_pad(array_map('trim', $cols), count($header), ''));
        }
        fclose($handle);

        $report = [];
        $errors = [];

        DB::beginTransaction();
        foreach ($rows as $i => $r) {
            $type = self::TYPE_MAP[strtolower($r['type'] ?? '')] ?? null;
            if (!$type || ($r['name'] ?? '') === '' || ($r['code'] ?? '') === '' || !is_numeric($r['qty'] ?? '')) {
                $errors[] = 'Line ' . ($i + 2) . ': needs a known Type, a Name, a Code and a numeric Qty';
                continue;
            }

            $qty = (float) $r['qty'];
            $values = [
                'name'       => $r['name'],
                'type'       => $type,
                'quantity'   => $qty,
                'unit'       => $r['unit'] ?: 'pcs',
                'lot'        => $r['lot'] !== '' ? $r['lot'] : null,
                'status'     => $qty <= 0 ? 'out' : 'ok',
                'updated_at' => now(),
            ];
            if (($r['price'] ?? '') !== '') {
                $values['price'] = (float) $r['price'];
            }

            // Query builder on purpose: no observer history/notifications for a bulk stock load
            $existing = DB::table('inventory_items')->whereRaw('LOWER(TRIM(code)) = ?', [mb_strtolower($r['code'])])->first();
            if ($existing) {
                if ((float) $existing->min_stock > 0 && $qty > 0 && $qty <= (float) $existing->min_stock) {
                    $values['status'] = 'low';
                }
                DB::table('inventory_items')->where('id', $existing->id)->update($values);
                $report[] = ['updated', $type, $r['name'], $r['code'], $qty . ' ' . $values['unit']];
            } else {
                DB::table('inventory_items')->insert($values + [
                    'code'        => $r['code'],
                    'price'       => $values['price'] ?? 0,
                    'min_stock'   => 0,
                    'supplier_id' => null,
                    'created_at'  => now(),
                ]);
                $report[] = ['created', $type, $r['name'], $r['code'], $qty . ' ' . $values['unit']];
            }
        }

        if ($errors) {
            DB::rollBack();
            foreach ($errors as $e) $this->error($e);
            $this->error('Nothing was saved. Fix the lines above and run again.');
            return self::FAILURE;
        }

        $this->option('dry-run') ? DB::rollBack() : DB::commit();

        $this->table(['Action', 'Type', 'Name', 'Code', 'Qty'], $report);
        $created = count(array_filter($report, fn($r) => $r[0] === 'created'));
        $this->info(($this->option('dry-run') ? 'Dry run — nothing saved. ' : 'Saved. ')
            . "{$created} created, " . (count($report) - $created) . ' updated.');
        return self::SUCCESS;
    }
}
