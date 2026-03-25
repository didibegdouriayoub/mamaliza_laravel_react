<?php

namespace App\Services;

use App\Models\Batch;
use App\Models\InventoryItem;
use App\Models\RecipeIngredient;
use Illuminate\Support\Facades\Log;

class InventoryService
{
    /**
     * Deduct materials based on the recipe when a batch starts
     */
    public function deductForBatch(Batch $batch)
    {
        try {
            // Find recipe ingredients
            $ingredients = RecipeIngredient::where('recipe_id', $batch->recipe_id)->get();

            foreach ($ingredients as $ingredient) {
                $item = InventoryItem::find($ingredient->material_id);
                if ($item) {
                    $item->quantity -= $ingredient->quantity;
                    $item->save();
                    
                    // The InventoryItemObserver will handle low-stock notifications
                }
            }
        } catch (\Exception $e) {
            Log::error("Failed to deduct inventory for batch {$batch->id}: " . $e->getMessage());
            throw $e;
        }
    }
}
