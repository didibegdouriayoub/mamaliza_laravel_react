<?php

namespace App\Http\Controllers;

use App\Models\PackagingMaterial;
use Illuminate\Http\Request;

class PackagingMaterialController extends Controller
{
    public function index(Request $request)
    {
        $query = PackagingMaterial::query();

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        return response()->json($query->orderBy('name')->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'            => 'required|string|max:255',
            'code'            => 'required|string|max:100|unique:packaging_materials,code',
            'type'            => 'required|in:Box,Case,Vacbag,Label,Ticket,Wrap,Wax',
            'stock_qty'       => 'required|numeric|min:0',
            'stock_unit'      => 'required|in:pcs,kg,rolls',
            'low_stock_alert' => 'nullable|numeric|min:0',
            'account_code'    => 'nullable|integer',
            'dim_length'      => 'nullable|numeric|min:0',
            'dim_width'       => 'nullable|numeric|min:0',
            'dim_height'      => 'nullable|numeric|min:0',
            'notes'           => 'nullable|string',
        ]);

        $material = PackagingMaterial::create($validated);
        return response()->json($material, 201);
    }

    public function show(PackagingMaterial $packagingMaterial)
    {
        return response()->json($packagingMaterial);
    }

    public function update(Request $request, PackagingMaterial $packagingMaterial)
    {
        $validated = $request->validate([
            'name'            => 'sometimes|string|max:255',
            'code'            => 'sometimes|string|max:100|unique:packaging_materials,code,' . $packagingMaterial->id,
            'type'            => 'sometimes|in:Box,Case,Vacbag,Label,Ticket,Wrap,Wax',
            'stock_qty'       => 'sometimes|numeric|min:0',
            'stock_unit'      => 'sometimes|in:pcs,kg,rolls',
            'low_stock_alert' => 'nullable|numeric|min:0',
            'account_code'    => 'nullable|integer',
            'dim_length'      => 'nullable|numeric|min:0',
            'dim_width'       => 'nullable|numeric|min:0',
            'dim_height'      => 'nullable|numeric|min:0',
            'notes'           => 'nullable|string',
        ]);

        $packagingMaterial->update($validated);
        return response()->json($packagingMaterial->refresh());
    }

    public function destroy(PackagingMaterial $packagingMaterial)
    {
        $packagingMaterial->delete();
        return response()->json(null, 204);
    }
}
