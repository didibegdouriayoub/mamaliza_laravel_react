<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class PackagingMaterialsSeeder extends Seeder
{
    public function run(): void
    {
        $materials = [
            // Boxes & Cases
            ['name' => 'Kroom Rect Box',           'code' => 'BOX-KROOM-RECT',              'type' => 'Box',    'stock_qty' => 9560,  'stock_unit' => 'pcs'],
            ['name' => 'Kroom Rect Shipping Case',  'code' => 'CASE-KROOM-RECT',             'type' => 'Case',   'stock_qty' => 622,   'stock_unit' => 'pcs'],
            ['name' => 'Mozzarella Shipping Case',  'code' => 'CASE-MOZ',                    'type' => 'Case',   'stock_qty' => 1962,  'stock_unit' => 'pcs'],
            ['name' => 'Bola Shipping Case',        'code' => 'CASE-BOLA',                   'type' => 'Case',   'stock_qty' => 50,    'stock_unit' => 'pcs'],
            ['name' => 'Large Intercalaire',        'code' => 'CASE-INTERC-L',               'type' => 'Case',   'stock_qty' => 8088,  'stock_unit' => 'pcs'],
            ['name' => 'Medium Intercalaire',       'code' => 'CASE-INTERC-M',               'type' => 'Case',   'stock_qty' => 7570,  'stock_unit' => 'pcs'],
            // Vacuum Bags
            ['name' => 'Moz Bloc 1Kg White Vacbag',       'code' => 'VACBAG-MOZ-BLOC-1KG-WHITE',      'type' => 'Vacbag', 'stock_qty' => 4872,  'stock_unit' => 'pcs'],
            ['name' => 'Moz Bloc 1Kg Trans Vacbag',       'code' => 'VACBAG-MOZ-BLOC-1KG-TRANS',      'type' => 'Vacbag', 'stock_qty' => 2146,  'stock_unit' => 'pcs'],
            ['name' => 'Moz Bloc 1Kg White Wide Vacbag',  'code' => 'VACBAG-MOZ-BLOC-1KG-WHITEWIDE',  'type' => 'Vacbag', 'stock_qty' => 1425,  'stock_unit' => 'pcs'],
            ['name' => 'Moz Rape 500g Vacbag',            'code' => 'VACBAG-MOZ-RAPE-500G',            'type' => 'Vacbag', 'stock_qty' => 2243,  'stock_unit' => 'pcs'],
            ['name' => 'Moz Rape 200g Vacbag',            'code' => 'VACBAG-MOZ-RAPE-200G',            'type' => 'Vacbag', 'stock_qty' => 2530,  'stock_unit' => 'pcs'],
            ['name' => 'Moz Rape 1Kg Vacbag',             'code' => 'VACBAG-MOZ-RAPE-1KG',             'type' => 'Vacbag', 'stock_qty' => 2536,  'stock_unit' => 'pcs'],
            ['name' => 'Kroom Rect Vacbag',               'code' => 'VACBAG-KROOM-RECT',               'type' => 'Vacbag', 'stock_qty' => 20177, 'stock_unit' => 'pcs'],
            ['name' => 'Portion S White Vacbag',          'code' => 'VACBAG-PORTION-S-WHITE',          'type' => 'Vacbag', 'stock_qty' => 5182,  'stock_unit' => 'pcs'],
            ['name' => 'Portion S Trans Vacbag',          'code' => 'VACBAG-PORTION-S-TRANS',          'type' => 'Vacbag', 'stock_qty' => 9611,  'stock_unit' => 'pcs'],
            ['name' => 'Portion M White Vacbag',          'code' => 'VACBAG-PORTION-M-WHITE',          'type' => 'Vacbag', 'stock_qty' => 388,   'stock_unit' => 'pcs'],
            // Labels
            ['name' => 'Hibarella 190g Label',            'code' => 'LBL-HIBARELLA-190G',              'type' => 'Label',  'stock_qty' => 12517, 'stock_unit' => 'pcs'],
            ['name' => 'Sandrella Round 190g Label',      'code' => 'LBL-SANDRELLA-RND-190G',          'type' => 'Label',  'stock_qty' => 18000, 'stock_unit' => 'pcs'],
            ['name' => 'Sandrella Round 90g Label',       'code' => 'LBL-SANDRELLA-RND-90G',           'type' => 'Label',  'stock_qty' => 10900, 'stock_unit' => 'pcs'],
            ['name' => 'Sandrella Round 110g Label',      'code' => 'LBL-SANDRELLA-RND-110G',          'type' => 'Label',  'stock_qty' => 8671,  'stock_unit' => 'pcs'],
            ['name' => 'Sandrella Round 500g Label',      'code' => 'LBL-SANDRELLA-RND-500G',          'type' => 'Label',  'stock_qty' => 12640, 'stock_unit' => 'pcs'],
            ['name' => 'Kroom Edamde Round Old Label',    'code' => 'LBL-KROOM-EDAMDE-RND-OLD',        'type' => 'Label',  'stock_qty' => 6150,  'stock_unit' => 'pcs'],
            ['name' => 'Sandrella Rect 90g Label',        'code' => 'LBL-SANDRELLA-RECT-90G',          'type' => 'Label',  'stock_qty' => 18830, 'stock_unit' => 'pcs'],
            ['name' => 'Sandrella Rect 190g Label',       'code' => 'LBL-SANDRELLA-RECT-190G',         'type' => 'Label',  'stock_qty' => 19108, 'stock_unit' => 'pcs'],
            ['name' => 'King Round Label',                'code' => 'LBL-KING-RND',                    'type' => 'Label',  'stock_qty' => 9773,  'stock_unit' => 'pcs'],
            ['name' => 'Kroom Round Label',               'code' => 'LBL-KROOM-RND',                   'type' => 'Label',  'stock_qty' => 6332,  'stock_unit' => 'pcs'],
            ['name' => 'Santrella 1Kg Label',             'code' => 'LBL-SANTRELLA-1KG',               'type' => 'Label',  'stock_qty' => 7638,  'stock_unit' => 'pcs'],
            ['name' => 'Box Habarella Label',             'code' => 'LBL-BOX-HABARELLA',               'type' => 'Label',  'stock_qty' => 9914,  'stock_unit' => 'pcs'],
            ['name' => 'Box Mozabella Label',             'code' => 'LBL-BOX-MOZABELLA',               'type' => 'Label',  'stock_qty' => 10300, 'stock_unit' => 'pcs'],
            ['name' => 'Plastic Mozabella Rape Label',    'code' => 'LBL-PLASTIC-MOZABELLA-RAPE',      'type' => 'Label',  'stock_qty' => 4207,  'stock_unit' => 'pcs'],
            ['name' => 'Plastic Roja Rape Label',         'code' => 'LBL-PLASTIC-ROJA-RAPE',           'type' => 'Label',  'stock_qty' => 2015,  'stock_unit' => 'pcs'],
            ['name' => 'Roja Bloc Label',                 'code' => 'LBL-ROJA-BLOC',                   'type' => 'Label',  'stock_qty' => 9760,  'stock_unit' => 'pcs'],
            ['name' => 'Kroom Rect Label',                'code' => 'LBL-KROOM-RECT',                  'type' => 'Label',  'stock_qty' => 6685,  'stock_unit' => 'pcs'],
            ['name' => 'Hibarella Bloc Label',            'code' => 'LBL-HIBARELLA-BLOC',              'type' => 'Label',  'stock_qty' => 5000,  'stock_unit' => 'pcs'],
            ['name' => 'Mozabella Bloc Label',            'code' => 'LBL-MOZABELLA-BLOC',              'type' => 'Label',  'stock_qty' => 6132,  'stock_unit' => 'pcs'],
            ['name' => 'Kroom Pot Side Label',            'code' => 'LBL-KROOM-POT-SIDE',              'type' => 'Label',  'stock_qty' => 8542,  'stock_unit' => 'pcs'],
            ['name' => 'Kroom Pot Top Label',             'code' => 'LBL-KROOM-POT-TOP',               'type' => 'Label',  'stock_qty' => 8213,  'stock_unit' => 'pcs'],
        ];

        foreach ($materials as $material) {
            // Skip if already exists (idempotent)
            $exists = DB::table('packaging_materials')->where('code', $material['code'])->exists();
            if (!$exists) {
                DB::table('packaging_materials')->insert(array_merge($material, [
                    'created_at'   => now(),
                    'last_updated' => now(),
                ]));
            }
        }
    }
}
