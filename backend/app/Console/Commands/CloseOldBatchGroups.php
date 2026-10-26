<?php

namespace App\Console\Commands;

use App\Models\BatchGroup;
use Illuminate\Console\Command;

/**
 * Marks batch groups as done (they then disappear from the Finishing batch select),
 * except the N latest groups of one recipe. Lists what it would do unless --apply is given.
 */
class CloseOldBatchGroups extends Command
{
    protected $signature = 'batches:close-old {--recipe=Moza : keep open the latest groups whose recipe name contains this} {--keep=2 : how many of those to keep open} {--apply : really close them (without it, only list)}';

    protected $description = 'Mark all open batch groups as done except the latest ones of one recipe';

    public function handle(): int
    {
        $keepIds = BatchGroup::whereNull('closed_at')
            ->where('recipe_name', 'like', '%' . $this->option('recipe') . '%')
            ->orderByDesc('created_at')->orderByDesc('id')
            ->limit((int) $this->option('keep'))->pluck('id');

        $toClose = BatchGroup::whereNull('closed_at')->whereNotIn('id', $keepIds)->orderBy('created_at')->get();

        $this->info('Staying open:');
        foreach (BatchGroup::whereIn('id', $keepIds)->orderByDesc('created_at')->get() as $g) {
            $this->line("  #{$g->id} {$g->recipe_name} " . $g->created_at?->format('d-m-Y'));
        }
        $this->info($toClose->count() . ' group(s) to mark done:');
        foreach ($toClose as $g) {
            $this->line("  #{$g->id} {$g->recipe_name} " . $g->created_at?->format('d-m-Y'));
        }

        if (!$this->option('apply')) {
            $this->warn('Nothing changed. Run again with --apply to close them.');

            return self::SUCCESS;
        }

        BatchGroup::whereIn('id', $toClose->pluck('id'))->update(['closed_at' => now()]);
        $this->info('Done.');

        return self::SUCCESS;
    }
}
