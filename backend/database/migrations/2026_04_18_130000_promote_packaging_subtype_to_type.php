<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    // Packaging subtypes stored in lot during the previous migration
    private array $subtypes = ['Box', 'Case', 'Vacbag', 'Label', 'Ticket', 'Wrap', 'Wax'];

    public function up(): void
    {
        $all = implode("','", array_merge(['raw','packaging','leftover','product'], $this->subtypes));
        DB::statement("ALTER TABLE inventory_items MODIFY type ENUM('{$all}') NOT NULL DEFAULT 'raw'");

        foreach ($this->subtypes as $subtype) {
            DB::table('inventory_items')
                ->where('type', 'packaging')
                ->where('lot', $subtype)
                ->update(['type' => $subtype, 'lot' => null]);
        }
    }

    public function down(): void
    {
        foreach ($this->subtypes as $subtype) {
            DB::table('inventory_items')
                ->where('type', $subtype)
                ->update(['type' => 'packaging', 'lot' => $subtype]);
        }

        DB::statement("ALTER TABLE inventory_items MODIFY type ENUM('raw','packaging','leftover','product') NOT NULL DEFAULT 'raw'");
    }
};
