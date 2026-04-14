<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('packaging_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('carton_id')->constrained('packaging_cartons')->onDelete('cascade');
            $table->date('date');
            $table->integer('cartons_count')->default(0);
            $table->integer('loose_pieces')->default(0);
            $table->text('notes')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('packaging_logs');
    }
};
