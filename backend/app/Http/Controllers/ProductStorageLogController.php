<?php

namespace App\Http\Controllers;

use App\Models\ProductStorageLog;
use Illuminate\Http\Request;

class ProductStorageLogController extends Controller
{
    public function index()
    {
        return response()->json(
            ProductStorageLog::with(['location', 'product'])->orderByDesc('entry_date')->get()
        );
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'product_id'  => 'required|exists:inventory_items,id',
            'batch_id'    => 'nullable|exists:batches,id',
            'location_id' => 'required|exists:storage_locations,id',
            'quantity'    => 'required|numeric|min:0',
            'entry_date'  => 'required|date',
            'status'      => 'required|in:In Storage,In Use,Out',
        ]);

        return response()->json(
            ProductStorageLog::create($validated)->load(['location', 'product']),
            201
        );
    }

    public function update(Request $request, ProductStorageLog $productStorageLog)
    {
        $validated = $request->validate([
            'product_id'  => 'sometimes|exists:inventory_items,id',
            'batch_id'    => 'nullable|exists:batches,id',
            'location_id' => 'sometimes|exists:storage_locations,id',
            'quantity'    => 'sometimes|numeric|min:0',
            'entry_date'  => 'sometimes|date',
            'status'      => 'sometimes|in:In Storage,In Use,Out',
        ]);

        $productStorageLog->update($validated);
        return response()->json($productStorageLog->load(['location', 'product']));
    }

    public function destroy(ProductStorageLog $productStorageLog)
    {
        $productStorageLog->delete();
        return response()->json(null, 204);
    }
}
