<?php

namespace App\Console\Commands;

use App\Models\BatchGroup;
use App\Models\FinishedGoodsLot;
use App\Models\FinishedProduct;
use App\Models\FinishedProductComponent;
use App\Models\FinishingLog;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Gives existing finished-goods stock a lot code and a source batch group so it can be scanned.
 *
 *   php artisan lots:backfill-codes --dry-run
 *   php artisan lots:backfill-codes            (lots still in stock)
 *   php artisan lots:backfill-codes --all      (also lots already sold out)
 *
 * Code = product prefix + YYMMDD of the lot + product letters (cartons use their pieces' code).
 * Lots that came from a finishing log keep that log; the others get a "[backfill]" trace log
 * (no stock or packaging effect) linked to the product's recipe batch group.
 */
class BackfillLotCodes extends Command
{
    public const MARKER = '[backfill]';

    protected $signature = 'lots:backfill-codes
        {--dry-run : Show what would change without saving}
        {--all : Also include lots that are already sold out}';

    protected $description = 'Add lot codes and source batch links to existing finished-goods lots';

    private int $codes = 0;
    private int $logs = 0;
    private int $sources = 0;
    private array $noBatch = [];

    public function handle(): int
    {
        $dry = (bool) $this->option('dry-run');

        $lots = FinishedGoodsLot::with('product')
            ->when(!$this->option('all'), fn ($q) => $q->where('qty_remaining', '>', 0))
            ->whereNull('lot_code')
            ->orderBy('lot_date')->orderBy('id')->get();

        $this->info(($dry ? '[dry run] ' : '') . "{$lots->count()} lot(s) without a code.");

        DB::beginTransaction();
        try {
            foreach ($lots as $lot) {
                $product = $lot->product;
                if (!$product) {
                    continue;
                }
                $date = Carbon::parse($lot->lot_date);

                if ($product->type === 'box') {
                    $this->backfillCarton($lot, $product, $date);
                } else {
                    $this->backfillPiece($lot, $product, $date);
                }
            }
            $dry ? DB::rollBack() : DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            $this->error('Failed, nothing was saved: ' . $e->getMessage());
            return self::FAILURE;
        }

        $this->line("Codes set: {$this->codes} · trace logs created: {$this->logs} · batch links added: {$this->sources}");
        foreach (array_unique($this->noBatch) as $name) {
            $this->warn("No batch group found for \"{$name}\" (link a recipe in Products, or create batches first).");
        }

        return self::SUCCESS;
    }

    private function codeFor(FinishedProduct $product, Carbon $date): string
    {
        $letters = $product->lot_letters ?: strtoupper(substr(preg_replace('/[^A-Za-z]/', '', $product->name), 0, 3));

        return strtoupper($product->lot_prefix ?: 'TA') . $date->format('ymd') . strtoupper($letters);
    }

    private function backfillPiece(FinishedGoodsLot $lot, FinishedProduct $product, Carbon $date): void
    {
        $code = $this->codeFor($product, $date);
        $log = $lot->finishing_log_id ? FinishingLog::find($lot->finishing_log_id) : null;

        if ($log) {
            // a real earlier run: keep it, give it the code, and a source batch if it has none
            if (!$log->lot_code) {
                $log->update(['lot_code' => $code]);
            }
            $code = $log->lot_code;
            if ($log->batchSources()->count() === 0) {
                $this->linkBatch($log, $product, $date, (float) $lot->qty_produced);
            }
        } else {
            $this->ensureTraceLog($product, $date, $code, (float) $lot->qty_produced);
        }

        $lot->update(['lot_code' => $code]);
        $this->codes++;
    }

    private function backfillCarton(FinishedGoodsLot $lot, FinishedProduct $box, Carbon $date): void
    {
        $link = FinishedProductComponent::where('finished_product_id', $box->id)->orderBy('id')->first();
        $piece = $link ? FinishedProduct::find($link->component_id) : null;
        if (!$piece) {
            return;
        }

        // cartons carry the code of the pieces inside
        $code = $this->codeFor($piece, $date);
        $this->ensureTraceLog($piece, $date, $code, (float) $lot->qty_produced * (float) $link->qty_per_box);

        $lot->update(['lot_code' => $code]);
        $this->codes++;
    }

    /** One trace log per (piece product, code); real or backfilled, so the scan can find the run. */
    private function ensureTraceLog(FinishedProduct $product, Carbon $date, string $code, float $pieces): void
    {
        $existing = FinishingLog::where('finished_product_id', $product->id)->where('lot_code', $code)->first();
        if ($existing) {
            return;
        }

        $log = FinishingLog::create([
            'finished_product_id' => $product->id,
            'pieces_produced'     => max(1, (int) round($pieces)),
            'date'                => $date->toDateString(),
            'notes'               => self::MARKER . ' lot tracing for stock that existed before lot codes',
            'lot_code'            => $code,
        ]);
        $this->logs++;
        $this->linkBatch($log, $product, $date, $pieces);
    }

    /** Link the most recent batch group (on or before the date) of the product's recipe. */
    private function linkBatch(FinishingLog $log, FinishedProduct $product, Carbon $date, float $pieces): void
    {
        $inputs = $product->inputs()->get();
        $recipeIds = $inputs->pluck('recipe_id')->all();
        $group = null;

        if ($recipeIds) {
            $groups = BatchGroup::whereIn('recipe_id', $recipeIds);
            $group = (clone $groups)->where('created_at', '<=', $date->copy()->endOfDay())->orderByDesc('created_at')->first()
                ?? $groups->orderByDesc('created_at')->first();
        }
        if (!$group) {
            $this->noBatch[] = $product->name;
            return;
        }

        $kgPerPiece = (float) optional($inputs->firstWhere('recipe_id', $group->recipe_id))->kg_per_piece;
        $log->batchSources()->create(['batch_group_id' => $group->id, 'kg_used' => round($pieces * $kgPerPiece, 4)]);
        $this->sources++;
    }
}
