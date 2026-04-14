<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('packaging_cartons', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('product_name');
            $table->integer('pieces_per_carton');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('packaging_cartons');
    }
};
