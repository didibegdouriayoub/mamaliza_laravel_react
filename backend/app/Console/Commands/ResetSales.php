<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Services\FinishedStockService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Deletes factures (and optionally devis) the way the app does: finished-goods stock that those sales took
 * goes back, payments and returns go with them, and the FA-/DV- numbering starts again from 0001.
 *
 *   php artisan sales:reset --dry-run               (shows what would happen, changes nothing)
 *   php artisan sales:reset                          (factures only, asks to confirm)
 *   php artisan sales:reset --include-devis --force  (factures and devis, no question)
 */
class ResetSales extends Command
{
    protected $signature = 'sales:reset
        {--include-devis : Also delete the devis}
        {--dry-run : Show what would be deleted without changing anything}
        {--force : Do not ask for confirmation}';

    protected $description = 'Delete all factures (and optionally devis), restoring their stock and numbering';

    public function handle(FinishedStockService $stock): int
    {
        $types = $this->option('include-devis') ? ['facture', 'order', 'devis'] : ['facture', 'order'];
        $orders = Order::whereIn('document_type', $types)->with(['items', 'payments', 'returns'])->orderBy('id')->get();

        if ($orders->isEmpty()) {
            $this->info('Nothing to delete.');

            return self::SUCCESS;
        }

        $this->line('To delete:');
        foreach ($orders->groupBy(fn ($o) => $o->document_type === 'devis' ? 'devis' : 'factures') as $label => $group) {
            $this->line(sprintf('  %-8s %d  (%d lines, %d payments, %d returns)', $label, $group->count(),
                $group->sum(fn ($o) => $o->items->count()), $group->sum(fn ($o) => $o->payments->count()), $group->sum(fn ($o) => $o->returns->count())));
        }
        $kept = Order::whereNotIn('document_type', $types)->count();
        $this->line("  kept     {$kept}" . ($this->option('include-devis') ? '' : ' (devis; use --include-devis to delete them too)'));

        if ($this->option('dry-run')) {
            $this->info('[dry run] nothing was changed.');

            return self::SUCCESS;
        }

        if (!$this->option('force') && !$this->confirm("Delete these {$orders->count()} documents? This cannot be undone.", false)) {
            $this->warn('Cancelled. Nothing was changed.');

            return self::FAILURE;
        }

        DB::transaction(function () use ($orders, $stock, $types) {
            foreach ($orders as $order) {
                $stock->restoreForOrder($order); // finished-goods stock goes back (devis never touched it)
                $order->delete();                // lines, payments and returns follow
            }

            // numbering restarts after the highest number that is still in use
            foreach (DB::table('document_counters')->get() as $row) {
                $prefix = $row->type === 'devis' ? 'DV' : 'FA';
                $max = 0;
                foreach (Order::where('doc_number', 'like', "{$prefix}-{$row->year}-%")->pluck('doc_number') as $number) {
                    $max = max($max, (int) substr($number, strrpos($number, '-') + 1));
                }
                DB::table('document_counters')->where('id', $row->id)->update(['last' => $max]);
            }
        });

        $this->info("Deleted {$orders->count()} documents. Stock was restored and numbering restarts at 0001.");

        return self::SUCCESS;
    }
}
