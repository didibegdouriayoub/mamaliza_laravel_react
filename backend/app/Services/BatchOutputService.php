<?php

namespace App\Services;

use App\Models\Batch;
use App\Models\InventoryItem;

/**
 * Output stage of a batch (one mix): dough weight, steam water, fat % and protein %.
 * Only available once the batch group is Done, because the real dough is
 * kg used in Finishing + leftover recorded on the group.
 */
class BatchOutputService
{
    public function forBatch(Batch $batch): array
    {
        $group = $batch->batchGroup;
        $done = (bool) $group?->closed_at;
        $quality = $batch->quality;

        $result = [
            'available'  => $done,
            'reason'     => $done ? null : ($group ? 'The batch group is not Done yet.' : 'This batch has no batch group.'),
            'groupDoughKg' => null, 'usedKg' => null, 'leftoverKg' => null,
            'autoOutputKg' => null, 'outputKg' => null, 'isDefault' => true,
            'ingredientsKg' => 0.0, 'waterKg' => (float) ($quality?->water_kg ?? 0), 'steamKg' => null,
            'fatKg' => null, 'proteinKg' => null, 'fatPct' => null, 'proteinPct' => null,
            'rework' => [], 'missingComposition' => [],
        ];

        $lines = $this->ingredientLines($batch);
        $result['ingredientsKg'] = round(array_sum(array_column($lines, 'kg')), 3);
        $result['rework'] = array_values(array_filter($lines, fn ($l) => $l['rework']));
        $result['missingComposition'] = array_values(array_unique(array_column(
            array_filter($lines, fn ($l) => $l['missing']), 'name'
        )));

        if (!$done) {
            return $result;
        }

        $used = (float) $group->finishingSources()->sum('kg_used');
        $leftover = (float) $group->leftover_qty;
        $count = max(1, (int) $group->batch_count);
        $groupDough = $used + $leftover;

        // Default for this mix: the first mix of the group if it was entered, else an equal share of the real dough
        $first = $group->batches()->orderBy('id')->first();
        $firstOutput = ($first && $first->id !== $batch->id) ? $first->quality?->output_kg : null;
        $auto = $firstOutput !== null ? (float) $firstOutput : $groupDough / $count;

        $output = $quality?->output_kg !== null ? (float) $quality->output_kg : $auto;
        $fat = array_sum(array_column($lines, 'fatKg'));
        $protein = array_sum(array_column($lines, 'proteinKg'));

        return array_merge($result, [
            'groupDoughKg' => round($groupDough, 3), 'usedKg' => round($used, 3), 'leftoverKg' => round($leftover, 3),
            'autoOutputKg' => round($auto, 3), 'outputKg' => round($output, 3),
            'isDefault' => $quality?->output_kg === null,
            // water that left as steam = dough made - everything that went in
            'steamKg' => round($output - ($result['ingredientsKg'] + $result['waterKg']), 3),
            'fatKg' => round($fat, 3), 'proteinKg' => round($protein, 3),
            'fatPct' => $output > 0 ? round($fat / $output * 100, 2) : null,
            'proteinPct' => $output > 0 ? round($protein / $output * 100, 2) : null,
        ]);
    }

    /** One line per ingredient: kg, and the fat / protein it brings (per 100 g of the lot's item). */
    private function ingredientLines(Batch $batch): array
    {
        $materials = collect($batch->input_materials ?? []);
        $items = InventoryItem::whereIn('id', $materials->map(fn ($m) => $m['material_id'] ?? $m['materialId'] ?? $m['id'] ?? 0)->filter())
            ->get()->keyBy('id');

        return $materials->map(function ($m) use ($items) {
            $item = $items->get($m['material_id'] ?? $m['materialId'] ?? $m['id'] ?? 0);
            $unit = strtolower((string) ($m['unit'] ?? $item?->unit ?? 'kg'));
            $qty = (float) ($m['quantity'] ?? 0);
            $kg = match ($unit) { 'kg' => $qty, 'g' => $qty / 1000, default => 0.0 };
            $rework = $item?->type === 'leftover';
            // a dairy/fat (or rework) item without fat/protein values cannot be counted: flag it
            $needsValues = $item && ($item->category === 'dairy_fat' || $rework);
            $missing = $needsValues && ($item->fat_pct === null || $item->protein_pct === null);

            return [
                'name' => $m['material_name'] ?? $m['materialName'] ?? $item?->name ?? '—',
                'kg' => $kg, 'rework' => $rework, 'missing' => $missing,
                'fatKg' => $kg * (float) ($item?->fat_pct ?? 0) / 100,
                'proteinKg' => $kg * (float) ($item?->protein_pct ?? 0) / 100,
            ];
        })->all();
    }
}
