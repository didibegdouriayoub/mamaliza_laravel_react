<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Copy every packaging_material into inventory_items (type='packaging').
        //    Store the packaging subtype (Box/Case/Vacbag/Label) in the `lot` column.
        $materials = DB::table('packaging_materials')->get();

        $idMap = []; // packaging_materials.id => inventory_items.id

        foreach ($materials as $pm) {
            $qty    = (float) $pm->stock_qty;
            $min    = (float) ($pm->low_stock_alert ?? 0);
            $status = $qty <= 0 ? 'out' : ($min > 0 && $qty <= $min ? 'low' : 'ok');

            $newId = DB::table('inventory_items')->insertGetId([
                'name'       => $pm->name,
                'type'       => 'packaging',
                'quantity'   => $qty,
                'unit'       => $pm->stock_unit,
                'price'      => 0,
                'min_stock'  => $min,
                'status'     => $status,
                'lot'        => $pm->type, // Box / Case / Vacbag / Label
                'code'       => $pm->code,
                'supplier_id'=> null,
                'created_at' => $pm->created_at ?? now(),
                'updated_at' => $pm->updated_at ?? now(),
            ]);

            $idMap[$pm->id] = $newId;
        }

        // 2. Drop the FK on carton_materials, remap material_id, add new FK to inventory_items.
        DB::statement('ALTER TABLE carton_materials DROP FOREIGN KEY carton_materials_material_id_foreign');

        foreach ($idMap as $oldId => $newId) {
            DB::table('carton_materials')
                ->where('material_id', $oldId)
                ->update(['material_id' => $newId]);
        }

        DB::statement('ALTER TABLE carton_materials ADD CONSTRAINT carton_materials_material_id_foreign
            FOREIGN KEY (material_id) REFERENCES inventory_items(id) ON DELETE CASCADE');
    }

    public function down(): void
    {
        // Reverse: re-point carton_materials back to packaging_materials by matching code.
        DB::statement('ALTER TABLE carton_materials DROP FOREIGN KEY carton_materials_material_id_foreign');

        $pkgItems = DB::table('inventory_items')->where('type', 'packaging')->get();
        foreach ($pkgItems as $ii) {
            $pm = DB::table('packaging_materials')->where('code', $ii->code)->first();
            if ($pm) {
                DB::table('carton_materials')
                    ->where('material_id', $ii->id)
                    ->update(['material_id' => $pm->id]);
            }
        }

        DB::statement('ALTER TABLE carton_materials ADD CONSTRAINT carton_materials_material_id_foreign
            FOREIGN KEY (material_id) REFERENCES packaging_materials(id) ON DELETE CASCADE');

        DB::table('inventory_items')->where('type', 'packaging')->delete();
    }
};
