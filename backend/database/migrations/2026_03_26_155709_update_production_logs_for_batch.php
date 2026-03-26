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
        Schema::table('production_logs', function (Blueprint $table) {
            $table->string('batch_id')->nullable();
            $table->string('recipe_name')->nullable();
            $table->string('operator_id')->nullable();
            $table->string('operator_name')->nullable();
            $table->decimal('produced_pieces', 12, 3)->default(0);
            $table->string('unit')->nullable();
            $table->text('notes')->nullable();
            $table->date('logged_at')->nullable();
            
            // Allow date to be nullable to avoid unique constraints or just rely on logged_at
            $table->date('date')->nullable()->change();
            $table->json('totals')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('production_logs', function (Blueprint $table) {
            $table->dropColumn([
                'batch_id', 'recipe_name', 'operator_id', 'operator_name',
                'produced_pieces', 'unit', 'notes', 'logged_at'
            ]);
        });
    }
};
