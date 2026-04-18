<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Creates one "Low Stock Alert" notification for every inventory item
 * currently at status='low'. Skips items that already have an unread
 * notification so it is safe to run multiple times.
 *
 * Run with:
 *   php artisan db:seed --class=LowStockNotificationsSeeder
 */
class LowStockNotificationsSeeder extends Seeder
{
    public function run(): void
    {
        $items = DB::table('inventory_items')->where('status', 'low')->get();

        $created = 0;
        $skipped = 0;

        foreach ($items as $item) {
            $alreadyExists = DB::table('notifications')
                ->where('title', 'Low Stock Alert')
                ->where('message', 'like', "%'{$item->name}'%")
                ->where(function ($q) {
                    $q->whereNull('read_by')
                      ->orWhere('read_by', '[]')
                      ->orWhereJsonLength('read_by', 0);
                })
                ->exists();

            if ($alreadyExists) {
                $skipped++;
                continue;
            }

            DB::table('notifications')->insert([
                'title'          => 'Low Stock Alert',
                'message'        => "Inventory item '{$item->name}' is running low ({$item->quantity} {$item->unit}). Please restock.",
                'type'           => 'warning',
                'target_roles'   => json_encode(['admin']),
                'target_user_id' => null,
                'read_by'        => json_encode([]),
                'created_at'     => now(),
                'updated_at'     => now(),
            ]);

            $created++;
        }

        $this->command->info("Done. Created: {$created}, already notified (skipped): {$skipped}.");
    }
}
