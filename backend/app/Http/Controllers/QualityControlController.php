<?php

namespace App\Http\Controllers;

use App\Models\QualityControl;
use Illuminate\Http\Request;

class QualityControlController extends Controller
{
    public function index()
    {
        return response()->json(QualityControl::latest()->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'batch_id' => 'required|exists:batches,id',
            'taste' => 'required|integer|min:1|max:10',
            'texture' => 'required|integer|min:1|max:10',
            'smell' => 'required|integer|min:1|max:10',
            'overall_score' => 'required|numeric|min:0|max:100',
            'approved' => 'required|boolean',
            'evaluated_by' => 'nullable|exists:users,id',
            'evaluator' => 'required|string|max:255',
            'notes' => 'nullable|string',
            'evaluated_at' => 'nullable|date',
        ]);

        $qualityControl = QualityControl::create($validated);
        return response()->json($qualityControl, 201);
    }

    public function show(QualityControl $qualityControl)
    {
        return response()->json($qualityControl->load('batch'));
    }

    public function update(Request $request, QualityControl $qualityControl)
    {
        $validated = $request->validate([
            'taste' => 'sometimes|integer|min:1|max:10',
            'texture' => 'sometimes|integer|min:1|max:10',
            'smell' => 'sometimes|integer|min:1|max:10',
            'overall_score' => 'sometimes|numeric|min:0|max:100',
            'approved' => 'sometimes|boolean',
            'evaluated_by' => 'nullable|exists:users,id',
            'evaluator' => 'sometimes|string|max:255',
            'notes' => 'nullable|string',
            'evaluated_at' => 'nullable|date',
        ]);

        $qualityControl->update($validated);
        return response()->json($qualityControl);
    }

    public function destroy(QualityControl $qualityControl)
    {
        $qualityControl->delete();
        return response()->json(null, 204);
    }
}
