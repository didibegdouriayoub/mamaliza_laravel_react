<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Printed box code = lot_prefix + YYMMDD (+ digits) + lot_letters, e.g. TA260806KRM
        Schema::table('finished_products', function (Blueprint $table) {
            $table->string('lot_prefix', 2)->nullable()->after('notes');
            $table->string('lot_letters', 6)->nullable()->after('lot_prefix');
        });

        Schema::table('finishing_logs', function (Blueprint $table) {
            $table->string('lot_code', 40)->nullable()->index()->after('notes');
        });

        Schema::table('finished_goods_lots', function (Blueprint $table) {
            $table->string('lot_code', 40)->nullable()->index()->after('lot_date');
        });

        // Default letters from the product name (first 3 letters), prefix TA
        foreach (DB::table('finished_products')->get(['id', 'name']) as $p) {
            $letters = strtoupper(substr(preg_replace('/[^A-Za-z]/', '', $p->name), 0, 3));
            DB::table('finished_products')->where('id', $p->id)->update([
                'lot_prefix'  => 'TA',
                'lot_letters' => $letters ?: null,
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('finished_goods_lots', fn (Blueprint $t) => $t->dropColumn('lot_code'));
        Schema::table('finishing_logs', fn (Blueprint $t) => $t->dropColumn('lot_code'));
        Schema::table('finished_products', fn (Blueprint $t) => $t->dropColumn(['lot_prefix', 'lot_letters']));
    }
};
