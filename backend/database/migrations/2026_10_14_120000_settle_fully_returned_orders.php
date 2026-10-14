<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Returns used to be added to the balance instead of subtracted. Factures whose goods were all given back
// (total - returned - paid <= 0) were left "pending"/"partial": mark them settled.
return new class extends Migration
{
    public function up(): void
    {
        DB::table('orders')
            ->where('document_type', 'facture')
            ->whereIn('status', ['pending', 'partial'])
            ->where('amount_returned', '>', 0)
            ->whereRaw('amount_paid >= total_amount - amount_returned - 0.009')
            ->update(['status' => 'paid', 'paid_at' => DB::raw('COALESCE(paid_at, NOW())')]);
    }

    public function down(): void
    {
        // not reversible: the previous status is not kept
    }
};
