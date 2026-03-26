<?php

namespace App\Http\Controllers;

use App\Models\InventoryItem;
use App\Models\InventoryHistory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InventoryItemController extends Controller
{
    public function index(Request $request)
    {
        $query = InventoryItem::with(['supplier', 'history.user']);

        if ($request->filled('search')) {
            $query->where('name', 'like', '%' . $request->search . '%');
        }
        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        return response()->json($query->latest()->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'required|in:raw,packaging',
            'quantity' => 'required|numeric|min:0',
            'unit' => 'required|string|max:50',
            'price' => 'required|numeric|min:0',
            'supplier_id' => 'required|exists:suppliers,id',
            'min_stock' => 'required|numeric|min:0',
        ]);

        $item = InventoryItem::create($validated);
        return response()->json($item->load('supplier'), 201);
    }

    public function show(InventoryItem $inventory)
    {
        return response()->json($inventory->load(['supplier', 'history.user']));
    }

    public function update(Request $request, InventoryItem $inventory)
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'type' => 'sometimes|in:raw,packaging',
            'quantity' => 'sometimes|numeric|min:0',
            'unit' => 'sometimes|string|max:50',
            'price' => 'sometimes|numeric|min:0',
            'supplier_id' => 'sometimes|exists:suppliers,id',
            'min_stock' => 'sometimes|numeric|min:0',
        ]);

        // Record history
        foreach ($validated as $key => $value) {
            if ($inventory->$key != $value) {
                InventoryHistory::create([
                    'item_id' => $inventory->id,
                    'field' => $key,
                    'old_value' => (string) $inventory->$key,
                    'new_value' => (string) $value,
                    'changed_by' => auth()->id(),
                ]);
            }
        }

        $inventory->update($validated);
        return response()->json($inventory->refresh()->load(['supplier', 'history.user']));
    }

    public function destroy(InventoryItem $inventory)
    {
        $inventory->delete();
        return response()->json(null, 204);
    }
}
