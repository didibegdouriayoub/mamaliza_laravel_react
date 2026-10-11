<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            // FA-2026-0001 (facture) / DV-2026-0001 (devis): each type counts on its own, no gaps
            $table->string('doc_number', 20)->nullable()->unique()->after('document_type');
            // a devis that was turned into a facture points to it
            $table->unsignedBigInteger('converted_to_id')->nullable()->after('doc_number');
        });

        Schema::create('document_counters', function (Blueprint $table) {
            $table->id();
            $table->string('type', 10);          // facture | devis
            $table->unsignedSmallInteger('year');
            $table->unsignedInteger('last')->default(0);
            $table->unique(['type', 'year']);
        });

        // The old "order" is a facture without paper: from now on there are only factures and devis.
        DB::table('orders')->where('document_type', 'order')->update(['document_type' => 'facture']);

        // Number the existing documents by date, per type and year.
        $counters = [];
        foreach (DB::table('orders')->orderBy('created_at')->orderBy('id')->get(['id', 'document_type', 'created_at']) as $o) {
            $type = $o->document_type === 'devis' ? 'devis' : 'facture';
            $year = (int) date('Y', strtotime($o->created_at ?? 'now'));
            $key = "{$type}|{$year}";
            $counters[$key] = ($counters[$key] ?? 0) + 1;
            DB::table('orders')->where('id', $o->id)->update([
                'doc_number' => ($type === 'devis' ? 'DV' : 'FA') . '-' . $year . '-' . str_pad((string) $counters[$key], 4, '0', STR_PAD_LEFT),
            ]);
        }
        foreach ($counters as $key => $last) {
            [$type, $year] = explode('|', $key);
            DB::table('document_counters')->insert(['type' => $type, 'year' => (int) $year, 'last' => $last]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('document_counters');
        Schema::table('orders', function (Blueprint $table) {
            $table->dropUnique(['doc_number']);
            $table->dropColumn(['doc_number', 'converted_to_id']);
        });
    }
};
