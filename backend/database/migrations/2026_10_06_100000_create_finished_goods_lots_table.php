<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('finished_goods_lots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('finished_product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('finishing_log_id')->nullable()->constrained()->nullOnDelete();
            $table->date('lot_date');
            $table->decimal('qty_produced', 10, 4);
            $table->decimal('qty_remaining', 10, 4);
            $table->boolean('is_opening')->default(false);
            $table->timestamps();

            $table->index(['finished_product_id', 'lot_date']);
        });

        // Existing totals become one "opening stock" lot dated today.
        $now = now();
        $rows = DB::table('finished_goods_stock')->where('quantity', '>', 0)->get();
        foreach ($rows as $row) {
            DB::table('finished_goods_lots')->insert([
                'finished_product_id' => $row->finished_product_id,
                'lot_date'            => $now->toDateString(),
                'qty_produced'        => $row->quantity,
                'qty_remaining'       => $row->quantity,
                'is_opening'          => true,
                'created_at'          => $now,
                'updated_at'          => $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('finished_goods_lots');
    }
};
