<?php

namespace App\Http\Controllers;

use App\Models\BatchGroup;
use App\Models\InventoryItem;
use Illuminate\Http\Request;

class BatchGroupController extends Controller
{
    public function index()
    {
        return response()->json(
            BatchGroup::with(['batches.notes', 'batches.qualityControl'])
                ->withSum('finishingSources as used_kg', 'kg_used')
                ->orderBy('created_at', 'desc')->get()
        );
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'recipe_id'         => 'nullable|integer',
            'recipe_name'       => 'required|string|max:255',
            'batch_count'       => 'required|integer|min:1',
            'target_weight'     => 'nullable|numeric|min:0',
            'piece_weight_value'=> 'nullable|numeric|min:0',
            'created_by'        => 'nullable|string|max:255',
            'date'              => 'nullable|date',
            'leftover_kg'       => 'nullable|numeric|min:0',
        ]);

        $leftover = (float) ($validated['leftover_kg'] ?? 0);
        $group = BatchGroup::create(collect($validated)->except(['date', 'leftover_kg'])->all());
        if ($leftover > 0) {
            // leftover scraped from the machines is recorded with the day's batches
            $this->recordLeftover($group, $leftover);
        }
        if (!empty($validated['date'])) {
            // The group takes the production date chosen in the form
            $group->created_at = $validated['date'];
            $group->save();
        }
        return response()->json($group, 201);
    }

    /** Record the leftover dough (kg) and mark the group done. Loss = expected - used - leftover (negative = gain). */
    public function close(Request $request, BatchGroup $batchGroup)
    {
        $validated = $request->validate(['leftover_kg' => 'nullable|numeric|min:0']);
        $leftover = (float) ($validated['leftover_kg'] ?? 0);

        if ($batchGroup->closed_at) {
            return response()->json(['message' => 'This batch group is already done.'], 422);
        }

        $batchGroup->update(['closed_at' => now()]);
        // leftover already recorded when the group was created is kept as is
        if ($leftover > 0 && (float) $batchGroup->leftover_qty <= 0) {
            $this->recordLeftover($batchGroup, $leftover);
        }

        return response()->json($batchGroup->loadSum('finishingSources as used_kg', 'kg_used'));
    }

    /** Save the leftover dough on the group and add it to inventory (min_stock 0 => never flagged "low"). */
    private function recordLeftover(BatchGroup $group, float $kg): void
    {
        $group->update(['leftover_qty' => $kg, 'leftover_unit' => 'kg']);
        InventoryItem::create([
            'name'        => 'LO-' . now()->format('d-m-Y') . "-{$group->recipe_name}",
            'type'        => 'leftover',
            'quantity'    => $kg,
            'unit'        => 'kg',
            'price'       => 0,
            'min_stock'   => 0,
            'supplier_id' => null,
        ]);
    }

    public function update(Request $request, BatchGroup $batchGroup)
    {
        $validated = $request->validate([
            'pieces_produced' => 'nullable|numeric|min:0',
            'leftover_qty'    => 'nullable|numeric|min:0',
            'leftover_unit'   => 'nullable|string|max:50',
        ]);

        $batchGroup->update($validated);

        // Auto-create leftover inventory entry
        if (!empty($validated['leftover_qty']) && $validated['leftover_qty'] > 0) {
            $date = now()->format('d-m-Y');
            InventoryItem::create([
                'name'        => "LO-{$date}-{$batchGroup->recipe_name}",
                'type'        => 'leftover',
                'quantity'    => $validated['leftover_qty'],
                'unit'        => $validated['leftover_unit'] ?? 'kg',
                'price'       => 0,
                'min_stock'   => 1,
                'supplier_id' => null,
            ]);
        }

        // Auto-create/update product inventory entry
        if (!empty($validated['pieces_produced']) && $validated['pieces_produced'] > 0) {
            $existing = InventoryItem::where('name', $batchGroup->recipe_name)
                ->where('type', 'product')->first();
            if ($existing) {
                $existing->increment('quantity', $validated['pieces_produced']);
            } else {
                InventoryItem::create([
                    'name'        => $batchGroup->recipe_name,
                    'type'        => 'product',
                    'quantity'    => $validated['pieces_produced'],
                    'unit'        => 'pcs',
                    'price'       => 0,
                    'min_stock'   => 0,
                    'supplier_id' => null,
                ]);
            }
        }

        return response()->json($batchGroup->load('batches'));
    }

    public function destroy(BatchGroup $batchGroup)
    {
        $batchGroup->batches()->delete();
        $batchGroup->delete();
        return response()->json(null, 204);
    }
}
