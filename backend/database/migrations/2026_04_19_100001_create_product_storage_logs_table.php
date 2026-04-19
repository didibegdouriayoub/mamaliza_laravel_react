<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('product_storage_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->unsignedBigInteger('batch_id')->nullable();
            $table->foreignId('location_id')->constrained('storage_locations')->cascadeOnDelete();
            $table->decimal('quantity', 10, 3);
            $table->date('entry_date');
            $table->enum('status', ['In Storage', 'In Use', 'Out'])->default('In Storage');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_storage_logs');
    }
};
