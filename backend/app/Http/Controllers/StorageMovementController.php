<?php

namespace App\Http\Controllers;

use App\Models\StorageMovement;
use Illuminate\Http\Request;

class StorageMovementController extends Controller
{
    public function index()
    {
        return response()->json(
            StorageMovement::with(['fromLocation', 'toLocation', 'operator', 'product'])
                ->orderByDesc('created_at')
                ->limit(200)
                ->get()
        );
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'product_id'       => 'required|exists:inventory_items,id',
            'from_location_id' => 'nullable|exists:storage_locations,id',
            'to_location_id'   => 'nullable|exists:storage_locations,id',
            'quantity'         => 'required|numeric|min:0.001',
            'reason'           => 'required|in:Packaging,Production,QC,Return',
            'operator_id'      => 'required|exists:users,id',
        ]);

        return response()->json(
            StorageMovement::create($validated)->load(['fromLocation', 'toLocation', 'operator', 'product']),
            201
        );
    }
}
