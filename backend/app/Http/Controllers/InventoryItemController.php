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
        $query = InventoryItem::with('supplier');

        if ($request->filled('search')) {
            $query->where('name', 'like', '%' . $request->search . '%');
        }
        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        return response()->json($query->latest()->get());
    }

    public function allHistory()
    {
        $records = InventoryHistory::with(['item:id,name,type', 'user:id,name'])
            ->whereHas('item', fn($q) => $q->whereIn('type', ['raw', 'packaging']))
            ->orderByDesc('changed_at')
            ->get()
            ->map(fn($h) => [
                'id'         => $h->id,
                'item_id'    => $h->item_id,
                'item_name'  => $h->item?->name,
                'field'      => $h->field,
                'old_value'  => $h->old_value,
                'new_value'  => $h->new_value,
                'changed_by' => $h->user?->name ?? 'System',
                'changed_at' => $h->changed_at,
            ]);

        return response()->json($records);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'required|in:raw,packaging',
            'quantity' => 'required|numeric|min:0',
            'unit' => 'required|string|max:50',
            'price' => 'required|numeric|min:0',
            'supplier_id' => 'nullable|exists:suppliers,id',
            'min_stock' => 'required|numeric|min:0',
            'lead_time_days' => 'nullable|integer|min:0',
            'lot' => 'nullable|string|max:50',
            'code' => 'nullable|string|max:100',
            'created_at' => 'nullable|date',
        ]);

        // created_at is not in $fillable, so set it manually after instantiation
        $createdAt = $validated['created_at'] ?? null;
        unset($validated['created_at']);

        $item = new InventoryItem($validated);
        if ($createdAt) {
            $item->created_at = $createdAt;
        }
        $item->save();

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
            'lead_time_days' => 'nullable|integer|min:0',
            'lot' => 'nullable|string|max:50',
            'code' => 'nullable|string|max:100',
            'created_at' => 'nullable|date',
        ]);

        // Record history
        foreach ($validated as $key => $value) {
            if ($key === 'created_at') continue; // Don't track created_at changes in history for now
            if (!isset($inventory->$key) && $value === null) continue;
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
        $usedInRecipes = \DB::table('recipe_ingredients')
            ->where('material_id', $inventory->id)
            ->join('recipes', 'recipes.id', '=', 'recipe_ingredients.recipe_id')
            ->pluck('recipes.name')
            ->unique()
            ->values();

        if ($usedInRecipes->isNotEmpty()) {
            return response()->json([
                'message' => "Cannot delete \"{$inventory->name}\" — it is used in " . $usedInRecipes->count() . " recipe(s): " . $usedInRecipes->implode(', ') . '.',
            ], 409);
        }

        $inventory->delete();
        return response()->json(null, 204);
    }
}
