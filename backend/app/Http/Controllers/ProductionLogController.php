<?php

namespace App\Http\Controllers;

use App\Models\ProductionLog;
use Illuminate\Http\Request;

class ProductionLogController extends Controller
{
    public function index()
    {
        return response()->json(ProductionLog::with('leftovers')->latest()->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'date' => 'required|date|unique:production_logs,date',
            'totals' => 'nullable|array',
        ]);

        $log = ProductionLog::create($validated);
        return response()->json($log, 201);
    }

    public function show(ProductionLog $productionLog)
    {
        return response()->json($productionLog->load('leftovers'));
    }

    public function update(Request $request, ProductionLog $productionLog)
    {
        $validated = $request->validate([
            'date' => 'sometimes|date|unique:production_logs,date,' . $productionLog->id,
            'totals' => 'nullable|array',
        ]);

        $productionLog->update($validated);
        return response()->json($productionLog);
    }

    public function destroy(ProductionLog $productionLog)
    {
        $productionLog->delete();
        return response()->json(null, 204);
    }
}
