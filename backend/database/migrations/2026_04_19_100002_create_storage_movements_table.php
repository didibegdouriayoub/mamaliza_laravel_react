<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('storage_movements', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->foreignId('from_location_id')->nullable()->constrained('storage_locations')->nullOnDelete();
            $table->foreignId('to_location_id')->nullable()->constrained('storage_locations')->nullOnDelete();
            $table->decimal('quantity', 10, 3);
            $table->enum('reason', ['Packaging', 'Production', 'QC', 'Return']);
            $table->foreignId('operator_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('storage_movements');
    }
};
