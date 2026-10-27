<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // One quality record per batch (mix). Production stage first; output and tasting columns come in later steps.
        Schema::create('batch_quality', function (Blueprint $table) {
            $table->id();
            $table->foreignId('batch_id')->unique()->constrained('batches')->cascadeOnDelete();

            // Production stage
            $table->decimal('ph', 4, 2)->nullable();
            $table->decimal('peak_temp', 5, 1)->nullable();
            $table->decimal('water_kg', 8, 3)->nullable();
            $table->text('production_notes')->nullable();
            $table->foreignId('production_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('production_by_name')->nullable();
            $table->timestamp('production_at')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('batch_quality');
    }
};
