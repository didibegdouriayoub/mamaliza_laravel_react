<?php

namespace App\Http\Controllers;

use App\Models\Batch;
use Illuminate\Http\Request;

class BatchController extends Controller
{
    public function index()
    {
        return response()->json(Batch::with(['notes', 'qualityControl'])->latest('id')->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'recipe_id' => 'required|exists:recipes,id',
            'recipe_name' => 'required|string|max:255',
            'status' => 'nullable|string|in:completed,failed',
            'batch_group_id' => 'nullable|exists:batch_groups,id',
            'input_materials' => 'nullable|array',
            'output_quantity' => 'nullable|numeric|min:0',
            'output_unit' => 'nullable|string|max:50',
            'quality_score' => 'nullable|numeric|min:0|max:100',
            'operator_id' => 'nullable|exists:users,id',
            'operator_name' => 'nullable|string|max:255',
            'started_at' => 'nullable|date',
            'completed_at' => 'nullable|date',
        ]);

        if (!isset($validated['status'])) {
            $validated['status'] = 'completed';
        }

        if (!isset($validated['started_at'])) {
            $validated['started_at'] = now()->toDateTimeString();
        }

        $batch = Batch::create($validated);

        // T9.1: Reduce inventory for each input material
        if (isset($validated['input_materials']) && is_array($validated['input_materials'])) {
            foreach ($validated['input_materials'] as $material) {
                $materialId = $material['material_id'] ?? $material['id'] ?? null;
                $quantity = $material['quantity'] ?? 0;

                if ($materialId && $quantity > 0) {
                    $item = \App\Models\InventoryItem::find($materialId);
                    if ($item) {
                        $oldQty = $item->quantity;
                        $item->decrement('quantity', $quantity);
                        
                        // Record Inventory History
                        \App\Models\InventoryHistory::create([
                            'item_id' => $item->id,
                            'field' => 'quantity',
                            'old_value' => (string)$oldQty,
                            'new_value' => (string)$item->quantity,
                            'changed_by' => auth()->id() ?: 1, // Fallback to admin if not auth
                        ]);
                    }
                }
            }
        }

        return response()->json($batch, 201);
    }

    public function show(Batch $batch)
    {
        return response()->json($batch->load(['notes', 'qualityControl']));
    }

    public function update(Request $request, Batch $batch)
    {
        $validated = $request->validate([
            'status' => 'sometimes|string|in:completed,failed',
            'input_materials' => 'nullable|array',
            'output_quantity' => 'nullable|numeric|min:0',
            'output_unit' => 'nullable|string|max:50',
            'quality_score' => 'nullable|numeric|min:0|max:100',
            'operator_id' => 'nullable|exists:users,id',
            'operator_name' => 'nullable|string|max:255',
            'started_at' => 'nullable|date',
            'completed_at' => 'nullable|date',
        ]);

        $batch->update($validated);
        return response()->json($batch);
    }

    public function storeNote(Request $request, Batch $batch)
    {
        $validated = $request->validate([
            'text'   => 'required|string',
            'author' => 'nullable|string|max:255',
        ]);

        $note = $batch->notes()->create([
            'text'      => $validated['text'],
            'author'    => $validated['author'] ?? (auth()->user()?->name ?? 'Unknown'),
            'author_id' => auth()->id(),
        ]);

        return response()->json($note, 201);
    }

    public function destroy(Batch $batch)
    {
        // T9.1: Restore inventory levels before deleting the batch
        if (isset($batch->input_materials) && is_array($batch->input_materials)) {
            foreach ($batch->input_materials as $material) {
                $materialId = $material['material_id'] ?? $material['id'] ?? null;
                $quantity = $material['quantity'] ?? 0;

                if ($materialId && $quantity > 0) {
                    $item = \App\Models\InventoryItem::find($materialId);
                    if ($item) {
                        $oldQty = $item->quantity;
                        $item->increment('quantity', $quantity);

                        // Record Inventory History
                        \App\Models\InventoryHistory::create([
                            'item_id' => $item->id,
                            'field' => 'quantity',
                            'old_value' => (string)$oldQty,
                            'new_value' => (string)$item->quantity,
                            'changed_by' => auth()->id() ?: 1,
                        ]);
                    }
                }
            }
        }

        $batch->delete();
        return response()->json(null, 204);
    }
}
