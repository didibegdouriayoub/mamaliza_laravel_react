<?php

namespace App\Http\Controllers;

use App\Models\Recipe;
use App\Models\RecipeHistory;
use App\Models\RecipeIngredient;
use Illuminate\Http\Request;

class RecipeController extends Controller
{
    public function index()
    {
        return response()->json(Recipe::with(['ingredients', 'history.user'])->latest()->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'steps' => 'nullable|array',
            'yield' => 'required|numeric|min:0',
            'yield_unit' => 'required|string|max:50',
            'version' => 'nullable|string|max:50',
        ]);

        if (!isset($validated['version'])) $validated['version'] = '1';

        $recipe = Recipe::create($validated);
        return response()->json($recipe, 201);
    }

    public function show(Recipe $recipe)
    {
        return response()->json($recipe->load(['ingredients', 'history']));
    }

    public function update(Request $request, Recipe $recipe)
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'steps' => 'nullable|array',
            'yield' => 'sometimes|numeric|min:0',
            'yield_unit' => 'sometimes|string|max:50',
            'version' => 'sometimes|string|max:50',
            'ingredients' => 'sometimes|array',
            'ingredients.*.material_id' => 'required|exists:inventory_items,id',
            'ingredients.*.quantity' => 'required|numeric|min:0',
        ]);

        // Record history for main fields (including steps array)
        foreach (['name', 'description', 'yield', 'yield_unit', 'steps'] as $field) {
            if (isset($validated[$field])) {
                $oldVal = $recipe->$field;
                $newVal = $validated[$field];
                
                $oldStr = is_array($oldVal) ? json_encode($oldVal) : (string)$oldVal;
                $newStr = is_array($newVal) ? json_encode($newVal) : (string)$newVal;

                if ($oldStr !== $newStr) {
                    RecipeHistory::create([
                        'recipe_id' => $recipe->id,
                        'field' => $field,
                        'old_value' => $oldStr,
                        'new_value' => $newStr,
                        'changed_by' => auth()->id(),
                    ]);
                }
            }
        }

        $recipe->update($validated);

        if (isset($validated['ingredients'])) {
            // Check if ingredients actually changed
            $oldIngs = $recipe->ingredients->map(fn($i) => ['material_id' => $i->material_id, 'quantity' => (float)$i->quantity])->values()->all();
            $newIngs = collect($validated['ingredients'])->map(fn($i) => ['material_id' => $i['material_id'], 'quantity' => (float)$i['quantity']])->values()->all();

            if (json_encode($oldIngs) !== json_encode($newIngs)) {
                 RecipeHistory::create([
                    'recipe_id' => $recipe->id,
                    'field' => 'ingredients',
                    'old_value' => count($oldIngs) . " ingredients",
                    'new_value' => count($newIngs) . " ingredients (updated)",
                    'changed_by' => auth()->id(),
                ]);
            }

            // Sync ingredients
            $recipe->ingredients()->delete();
            foreach ($validated['ingredients'] as $ing) {
                $material = \App\Models\InventoryItem::find($ing['material_id']);
                $recipe->ingredients()->create([
                    'material_id' => $ing['material_id'],
                    'material_name' => $material->name,
                    'quantity' => $ing['quantity'],
                    'unit' => $material->unit,
                    'unit_price' => $material->price,
                ]);
            }
        }

        return response()->json($recipe->refresh()->load(['ingredients', 'history.user']));
    }

    public function destroy(Recipe $recipe)
    {
        $recipe->delete();
        return response()->json(null, 204);
    }
}
