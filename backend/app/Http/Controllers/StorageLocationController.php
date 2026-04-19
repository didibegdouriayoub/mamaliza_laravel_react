<?php

namespace App\Http\Controllers;

use App\Models\StorageLocation;
use Illuminate\Http\Request;

class StorageLocationController extends Controller
{
    public function index()
    {
        return response()->json(StorageLocation::orderBy('name')->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'                 => 'required|string|max:255',
            'type'                 => 'required|in:Fridge,Room Temp,Workbench,Other',
            'temperature_required' => 'nullable|string|max:100',
            'capacity'             => 'nullable|string|max:100',
        ]);

        return response()->json(StorageLocation::create($validated), 201);
    }

    public function update(Request $request, StorageLocation $storageLocation)
    {
        $validated = $request->validate([
            'name'                 => 'sometimes|string|max:255',
            'type'                 => 'sometimes|in:Fridge,Room Temp,Workbench,Other',
            'temperature_required' => 'nullable|string|max:100',
            'capacity'             => 'nullable|string|max:100',
        ]);

        $storageLocation->update($validated);
        return response()->json($storageLocation);
    }

    public function destroy(StorageLocation $storageLocation)
    {
        $storageLocation->delete();
        return response()->json(null, 204);
    }
}
