<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// A tournee = a worker's daily load: stock leaves the fridge in the morning, is delivered to customers
// (factures) during the evening settle, and what is left comes back.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tournees', function (Blueprint $table) {
            $table->id();
            $table->string('worker_name');
            $table->date('date');
            $table->string('status', 10)->default('open'); // open | closed
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('tournee_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tournee_id')->constrained()->cascadeOnDelete();
            $table->foreignId('finished_product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('finished_goods_lot_id')->nullable()->constrained('finished_goods_lots')->nullOnDelete();
            $table->decimal('qty_loaded', 10, 4);
            $table->decimal('qty_returned', 10, 4)->default(0);
            $table->decimal('qty_lost', 10, 4)->default(0); // not delivered and not brought back
            $table->timestamps();
        });

        Schema::create('tournee_deliveries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tournee_item_id')->constrained('tournee_items')->cascadeOnDelete();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_item_id')->constrained('order_items')->cascadeOnDelete();
            $table->decimal('qty', 10, 4);
            $table->timestamps();
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('tournee_id')->nullable()->after('converted_to_id')->constrained('tournees')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('tournee_id');
        });
        Schema::dropIfExists('tournee_deliveries');
        Schema::dropIfExists('tournee_items');
        Schema::dropIfExists('tournees');
    }
};
