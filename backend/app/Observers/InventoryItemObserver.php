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

            // Notify only when LOW — out-of-stock items need no restock alert
            if ($status === 'low') {
                $alreadyNotified = \App\Models\Notification::where('title', 'Low Stock Alert')
                    ->where('message', 'like', "%'{$item->name}'%")
                    ->where(function ($q) {
                        $q->whereJsonLength('read_by', 0)->orWhereNull('read_by');
                    })
                    ->exists();

                if (!$alreadyNotified) {
                    $this->notificationService->sendToRole(
                        'admin',
                        'Low Stock Alert',
                        "Inventory item '{$item->name}' is running low (" . $item->quantity . " {$item->unit}). Please restock.",
                        'warning'
                    );
                }
            }
        }
    }
}
