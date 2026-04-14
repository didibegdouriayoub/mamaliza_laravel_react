<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('carton_materials', function (Blueprint $table) {
            $table->id();
            $table->foreignId('carton_id')->constrained('packaging_cartons')->onDelete('cascade');
            $table->foreignId('material_id')->constrained('packaging_materials')->onDelete('cascade');
            $table->decimal('amount_per_carton', 10, 3);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('carton_materials');
    }
};
