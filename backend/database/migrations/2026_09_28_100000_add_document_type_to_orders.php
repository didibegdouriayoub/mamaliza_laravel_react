<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            // 'order' = quick order from Sales page
            // 'facture' = invoice created from Devis & Facture page
            // 'devis'   = quote created from Devis & Facture page (no stock deduction)
            $table->string('document_type', 20)->default('order')->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('document_type');
        });
    }
};
