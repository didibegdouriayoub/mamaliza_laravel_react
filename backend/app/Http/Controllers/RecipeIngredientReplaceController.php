<?php

namespace App\Http\Controllers;

use App\Models\InventoryItem;
use App\Models\Recipe;
use App\Models\RecipeHistory;
use App\Models\RecipeIngredient;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Admin tool: swap one inventory item for another (e.g. a new lot) across recipes.
 * The replacement must share the item's code and unit; quantities stay the same.
 */
class RecipeIngredientReplaceController extends Controller
{
    /** Recipes using the item, plus the items allowed to replace it. */
    public function usage(InventoryItem $inventory)
    {
        $this->ensureAdmin();

        $recipes = RecipeIngredient::query()
            ->join('recipes', 'recipes.id', '=', 'recipe_ingredients.recipe_id')
            ->whereNull('recipes.deleted_at')
            ->where('recipe_ingredients.material_id', $inventory->id)
            ->orderBy('recipes.name')
            ->get([
                'recipes.id as recipe_id', 'recipes.name as recipe_name', 'recipes.description',
                'recipe_ingredients.quantity', 'recipe_ingredients.unit',
            ]);

        $candidates = $this->candidatesQuery($inventory)
            ->orderByDesc('quantity')
            ->get(['id', 'name', 'lot', 'code', 'unit', 'quantity', 'min_stock', 'price', 'status']);

        return response()->json([
            'item'       => $inventory->only(['id', 'name', 'lot', 'code', 'unit', 'quantity', 'min_stock']),
            'recipes'    => $recipes,
            'candidates' => $candidates,
        ]);
    }

    public function replace(Request $request)
    {
        $this->ensureAdmin();

        $validated = $request->validate([
            'from_material_id' => 'required|integer|exists:inventory_items,id',
            'to_material_id'   => 'required|integer|exists:inventory_items,id|different:from_material_id',
            'recipe_ids'       => 'required|array|min:1',
            'recipe_ids.*'     => 'integer|exists:recipes,id',
        ]);

        $from = InventoryItem::findOrFail($validated['from_material_id']);
        $to   = InventoryItem::findOrFail($validated['to_material_id']);

        if (!$this->candidatesQuery($from)->whereKey($to->id)->exists()) {
            return response()->json([
                'message' => 'The replacement must have the same code and unit as the original ingredient.',
            ], 422);
        }

        $label = fn(InventoryItem $i) => trim($i->name) . ($i->lot ? " (lot {$i->lot})" : '');
        $updated = [];

        DB::transaction(function () use ($validated, $from, $to, $label, &$updated) {
            $recipes = Recipe::whereIn('id', $validated['recipe_ids'])->get();

            foreach ($recipes as $recipe) {
                $line = $recipe->ingredients()->where('material_id', $from->id)->first();
                if (!$line) {
                    continue;
                }

                // If the recipe already lists the replacement, merge the two lines
                $existing = $recipe->ingredients()->where('material_id', $to->id)->first();
                if ($existing) {
                    $existing->update(['quantity' => (float) $existing->quantity + (float) $line->quantity]);
                    $line->delete();
                } else {
                    $line->update([
                        'material_id'   => $to->id,
                        'material_name' => $to->name,
                        'unit_price'    => $to->price,
                    ]);
                }

                RecipeHistory::create([
                    'recipe_id'  => $recipe->id,
                    'field'      => 'ingredients',
                    'old_value'  => "{$label($from)} — {$line->quantity} {$line->unit}",
                    'new_value'  => "{$label($to)} — {$line->quantity} {$line->unit}",
                    'changed_by' => auth()->id(),
                ]);
                $recipe->increment('version');
                $updated[] = $recipe->id;
            }
        });

        return response()->json(['updated_recipe_ids' => $updated, 'count' => count($updated)]);
    }

    /** Items with the same (case-insensitive) code and the same unit, excluding the item itself. */
    private function candidatesQuery(InventoryItem $item)
    {
        $code = mb_strtolower(trim((string) $item->code));

        return InventoryItem::query()
            ->where('id', '!=', $item->id)
            ->where('unit', $item->unit)
            ->whereNotIn('type', ['leftover', 'product'])
            ->when($code === '', fn($q) => $q->whereRaw('1 = 0'), fn($q) => $q->whereRaw('LOWER(TRIM(code)) = ?', [$code]));
    }

    private function ensureAdmin(): void
    {
        abort_unless(auth()->user()?->role === 'admin', 403, 'Only admins can replace ingredients in recipes.');
    }
}
