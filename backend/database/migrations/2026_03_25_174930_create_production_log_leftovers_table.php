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
        Schema::create('production_log_leftovers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('log_id')->constrained('production_logs')->cascadeOnDelete();
            $table->string('item');
            $table->decimal('amount', 12, 3);
            $table->string('unit', 50);
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('production_log_leftovers');
    }
};
