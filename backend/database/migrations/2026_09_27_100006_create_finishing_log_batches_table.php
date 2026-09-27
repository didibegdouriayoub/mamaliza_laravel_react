<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Which batch groups were used and how many kg drawn from each
        Schema::create('finishing_log_batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('finishing_log_id')->constrained()->cascadeOnDelete();
            $table->foreignId('batch_group_id')->constrained()->cascadeOnDelete();
            $table->decimal('kg_used', 10, 4);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finishing_log_batches');
    }
};
