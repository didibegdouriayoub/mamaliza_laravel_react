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
        Schema::create('quality_controls', function (Blueprint $table) {
            $table->id();
            $table->foreignId('batch_id')->constrained('batches')->cascadeOnDelete()->unique();
            $table->unsignedTinyInteger('taste');
            $table->unsignedTinyInteger('texture');
            $table->unsignedTinyInteger('smell');
            $table->decimal('overall_score', 3, 1);
            $table->boolean('approved')->default(false)->index();
            $table->foreignId('evaluated_by')->constrained('users')->restrictOnDelete();
            $table->string('evaluator');
            $table->text('notes')->nullable();
            $table->date('evaluated_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('quality_controls');
    }
};
