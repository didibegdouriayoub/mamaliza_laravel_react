<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // An open tournée still holds stock that left the fridge: close or delete it in the app before removing the feature
        if (Schema::hasTable('tournees') && DB::table('tournees')->where('status', 'open')->exists()) {
            throw new RuntimeException('There are still open tournées. Close or delete them first (their stock would be lost), then run the migration again.');
        }

        // orders.tournee_id stays as a plain number so old tournée factures never put stock back when deleted
        if (Schema::hasColumn('orders', 'tournee_id')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->dropForeign(['tournee_id']);
            });
        }

        Schema::dropIfExists('tournee_deliveries');
        Schema::dropIfExists('tournee_items');
        Schema::dropIfExists('tournees');
    }

    public function down(): void
    {
        // The tournée data is gone for good; restore it from a database backup if it is ever needed.
    }
};
