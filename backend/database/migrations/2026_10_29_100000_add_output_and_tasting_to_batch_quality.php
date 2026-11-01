<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('batch_quality', function (Blueprint $table) {
            // Output stage: only the value typed by the user; null = use the calculated default
            $table->decimal('output_kg', 8, 3)->nullable()->after('production_at');
            $table->text('output_notes')->nullable()->after('output_kg');
            $table->string('output_by_name')->nullable()->after('output_notes');
            $table->timestamp('output_at')->nullable()->after('output_by_name');

            // Tasting stage: scores 1-5 per criterion, verdict chosen by the taster (null = follow the suggestion)
            $table->json('tasting_scores')->nullable()->after('output_at');
            $table->string('tasting_verdict', 20)->nullable()->after('tasting_scores');
            $table->text('tasting_notes')->nullable()->after('tasting_verdict');
            $table->string('tasting_by_name')->nullable()->after('tasting_notes');
            $table->timestamp('tasting_at')->nullable()->after('tasting_by_name');
        });
    }

    public function down(): void
    {
        Schema::table('batch_quality', function (Blueprint $table) {
            $table->dropColumn([
                'output_kg', 'output_notes', 'output_by_name', 'output_at',
                'tasting_scores', 'tasting_verdict', 'tasting_notes', 'tasting_by_name', 'tasting_at',
            ]);
        });
    }
};
