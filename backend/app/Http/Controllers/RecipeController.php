<?php

namespace App\Http\Controllers;

use App\Models\Recipe;
use Illuminate\Http\Request;

class RecipeController extends Controller
{
    public function index()
    {
        return response()->json(Recipe::with('ingredients', 'history')->latest()->get());
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
        ]);

        $recipe->update($validated);
        return response()->json($recipe);
    }

    public function destroy(Recipe $recipe)
    {
        $recipe->delete();
        return response()->json(null, 204);
    }
}
