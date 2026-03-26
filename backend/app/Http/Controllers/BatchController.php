<?php

namespace App\Http\Controllers;

use App\Models\Batch;
use Illuminate\Http\Request;

class BatchController extends Controller
{
    public function index()
    {
        return response()->json(Batch::latest('id')->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'recipe_id' => 'required|exists:recipes,id',
            'recipe_name' => 'required|string|max:255',
            'status' => 'required|string|max:50',
            'input_materials' => 'nullable|array',
            'output_quantity' => 'nullable|numeric|min:0',
            'output_unit' => 'nullable|string|max:50',
            'quality_score' => 'nullable|numeric|min:0|max:100',
            'operator_id' => 'nullable|exists:users,id',
            'operator_name' => 'nullable|string|max:255',
            'started_at' => 'nullable|date',
            'completed_at' => 'nullable|date',
        ]);

        if (!isset($validated['started_at'])) {
            $validated['started_at'] = now()->toDateTimeString();
        }

        $batch = Batch::create($validated);
        return response()->json($batch, 201);
    }

    public function show(Batch $batch)
    {
        return response()->json($batch->load(['notes', 'qualityControl']));
    }

    public function update(Request $request, Batch $batch)
    {
        $validated = $request->validate([
            'status' => 'sometimes|string|max:50',
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

    public function destroy(Batch $batch)
    {
        $batch->delete();
        return response()->json(null, 204);
    }
}
