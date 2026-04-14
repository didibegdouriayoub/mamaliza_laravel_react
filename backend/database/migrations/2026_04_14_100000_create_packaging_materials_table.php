<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('packaging_materials', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code', 100)->unique();
            $table->enum('type', ['Box', 'Case', 'Vacbag', 'Label', 'Ticket', 'Wrap', 'Wax']);
            $table->decimal('stock_qty', 10, 3)->default(0);
            $table->enum('stock_unit', ['pcs', 'kg', 'rolls'])->default('pcs');
            $table->decimal('low_stock_alert', 10, 3)->nullable();
            $table->integer('account_code')->nullable();
            $table->decimal('dim_length', 8, 2)->nullable();
            $table->decimal('dim_width', 8, 2)->nullable();
            $table->decimal('dim_height', 8, 2)->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('last_updated')->useCurrent()->useCurrentOnUpdate();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('packaging_materials');
    }
};
