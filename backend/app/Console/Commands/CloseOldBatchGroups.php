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
    protected $signature = 'batches:close-old {--recipe=Moza : keep open the latest groups whose recipe name contains this} {--keep=2 : how many of those to keep open} {--keep-dates= : instead of the recipe rule, keep open the open groups made on these days (d-m-Y, comma separated)} {--keep-id=* : instead of the recipe rule, keep open this group id (repeatable)} {--zero-loss : closed groups get loss 0 (leftover = expected - used, written on the group only, nothing added to inventory)} {--apply : really close them (without it, only list)}';

    protected $description = 'Mark all open batch groups as done except the latest ones of one recipe';

    public function handle(): int
    {
        $dates = collect(explode(',', (string) $this->option('keep-dates')))->map('trim')->filter()
            ->map(fn ($d) => \Carbon\Carbon::createFromFormat('d-m-Y', $d)->toDateString());
        $ids = collect($this->option('keep-id'))->map('intval');

        if ($dates->isNotEmpty() || $ids->isNotEmpty()) {
            $keepIds = BatchGroup::whereNull('closed_at')
                ->where(fn ($q) => $q->whereIn('id', $ids)->orWhereIn(\DB::raw('DATE(created_at)'), $dates))
                ->pluck('id');
        } else {
            $keepIds = BatchGroup::whereNull('closed_at')
                ->where('recipe_name', 'like', '%' . $this->option('recipe') . '%')
                ->orderByDesc('created_at')->orderByDesc('id')
                ->limit((int) $this->option('keep'))->pluck('id');
        }

        $toClose = BatchGroup::whereNull('closed_at')->whereNotIn('id', $keepIds)->orderBy('created_at')->get();

        $this->info('Staying open:');
        foreach (BatchGroup::whereIn('id', $keepIds)->orderByDesc('created_at')->get() as $g) {
            $this->line("  #{$g->id} {$g->recipe_name} " . $g->created_at?->format('d-m-Y H:i') . " - {$g->batch_count} batch(es)");
        }
        $this->info($toClose->count() . ' group(s) to mark done:');
        foreach ($toClose as $g) {
            $this->line("  #{$g->id} {$g->recipe_name} " . $g->created_at?->format('d-m-Y'));
        }

        if (!$this->option('apply')) {
            $this->warn('Nothing changed. Run again with --apply to close them.');

            return self::SUCCESS;
        }

        foreach ($toClose as $g) {
            $update = ['closed_at' => now()];
            if ($this->option('zero-loss')) {
                // loss = expected - used - leftover: record the missing dough as leftover on the group (no inventory item)
                $missing = round($g->expectedKg() - (float) $g->finishingSources()->sum('kg_used'), 3);
                if ($missing > 0) {
                    $update += ['leftover_qty' => $missing, 'leftover_unit' => 'kg'];
                }
            }
            $g->update($update);
        }
        $this->info('Done.');

        return self::SUCCESS;
    }
}
