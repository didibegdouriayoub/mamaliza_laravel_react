<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The owner can never be demoted, changed or deleted. Set with: php artisan user:make-owner <email>
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_owner')->default(false)->after('role');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('is_owner');
        });
    }
};
