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
            BatchGroup::with(['batches.notes', 'batches.qualityControl'])->orderBy('created_at', 'desc')->get()
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
        ]);

        $group = BatchGroup::create($validated);
        return response()->json($group, 201);
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
                'min_stock'   => 0,
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
