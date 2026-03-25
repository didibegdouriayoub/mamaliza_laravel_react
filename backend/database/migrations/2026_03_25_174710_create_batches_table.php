<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('recipe_id')->constrained('recipes')->restrictOnDelete();
            $table->string('recipe_name');
            $table->enum('status', ['draft', 'in_production', 'completed', 'failed'])->default('draft')->index();
            $table->json('input_materials');
            $table->decimal('output_quantity', 12, 3)->default(0);
            $table->string('output_unit', 50)->default('');
            $table->decimal('quality_score', 3, 1)->nullable();
            $table->foreignId('operator_id')->constrained('users')->restrictOnDelete();
            $table->string('operator_name');
            $table->date('started_at')->index();
            $table->date('completed_at')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('batches');
    }
};
