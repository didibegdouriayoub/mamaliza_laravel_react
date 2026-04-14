<?php

namespace App\Http\Controllers;

use App\Models\PackagingCarton;
use App\Models\CartonMaterial;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PackagingCartonController extends Controller
{
    public function index()
    {
        $cartons = PackagingCarton::with('cartonMaterials')->orderBy('name')->get();
        return response()->json($cartons);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'              => 'required|string|max:255',
            'product_name'      => 'required|string|max:255',
            'pieces_per_carton' => 'required|integer|min:1',
            'materials'         => 'nullable|array',
            'materials.*.material_id'      => 'required|exists:packaging_materials,id',
            'materials.*.amount_per_carton' => 'required|numeric|min:0',
        ]);

        DB::transaction(function () use ($validated, &$carton) {
            $carton = PackagingCarton::create([
                'name'              => $validated['name'],
                'product_name'      => $validated['product_name'],
                'pieces_per_carton' => $validated['pieces_per_carton'],
            ]);

            foreach ($validated['materials'] ?? [] as $mat) {
                CartonMaterial::create([
                    'carton_id'          => $carton->id,
                    'material_id'        => $mat['material_id'],
                    'amount_per_carton'  => $mat['amount_per_carton'],
                ]);
            }
        });

        return response()->json($carton->load('cartonMaterials'), 201);
    }

    public function show(PackagingCarton $packagingCarton)
    {
        return response()->json($packagingCarton->load('cartonMaterials'));
    }

    public function update(Request $request, PackagingCarton $packagingCarton)
    {
        $validated = $request->validate([
            'name'              => 'sometimes|string|max:255',
            'product_name'      => 'sometimes|string|max:255',
            'pieces_per_carton' => 'sometimes|integer|min:1',
            'materials'         => 'nullable|array',
            'materials.*.material_id'      => 'required|exists:packaging_materials,id',
            'materials.*.amount_per_carton' => 'required|numeric|min:0',
        ]);

        DB::transaction(function () use ($validated, $packagingCarton) {
            $packagingCarton->update([
                'name'              => $validated['name'] ?? $packagingCarton->name,
                'product_name'      => $validated['product_name'] ?? $packagingCarton->product_name,
                'pieces_per_carton' => $validated['pieces_per_carton'] ?? $packagingCarton->pieces_per_carton,
            ]);

            if (array_key_exists('materials', $validated)) {
                // Replace all materials
                CartonMaterial::where('carton_id', $packagingCarton->id)->delete();
                foreach ($validated['materials'] ?? [] as $mat) {
                    CartonMaterial::create([
                        'carton_id'         => $packagingCarton->id,
                        'material_id'       => $mat['material_id'],
                        'amount_per_carton' => $mat['amount_per_carton'],
                    ]);
                }
            }
        });

        return response()->json($packagingCarton->refresh()->load('cartonMaterials'));
    }

    public function destroy(PackagingCarton $packagingCarton)
    {
        $packagingCarton->delete();
        return response()->json(null, 204);
    }
}
