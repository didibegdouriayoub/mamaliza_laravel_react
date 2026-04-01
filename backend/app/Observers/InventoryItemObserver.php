<?php

namespace App\Observers;

use App\Models\InventoryItem;
use App\Services\NotificationService;

class InventoryItemObserver
{
    protected NotificationService $notificationService;

    public function __construct(NotificationService $notificationService)
    {
        $this->notificationService = $notificationService;
    }

    public function updated(InventoryItem $item)
    {
        if ($item->wasChanged('quantity')) {
            // T13.4: keep status column in sync with actual quantity
            if ($item->quantity <= 0) {
                $status = 'out';
            } elseif ($item->min_stock > 0 && $item->quantity <= $item->min_stock) {
                $status = 'low';
            } else {
                $status = 'ok';
            }
            // Update without triggering observer again
            \DB::table('inventory_items')->where('id', $item->id)->update(['status' => $status]);

            // T12.9.3: send warning notification for low/out stock
            if ($status === 'out' || $status === 'low') {
                $this->notificationService->sendToRole(
                    'admin',
                    $status === 'out' ? 'Out of Stock Alert' : 'Low Stock Alert',
                    "Inventory item '{$item->name}' is " . ($status === 'out' ? 'out of stock' : 'running low') . " (" . $item->quantity . " {$item->unit}). Please restock.",
                    'warning'
                );
            }
        }
    }
}
