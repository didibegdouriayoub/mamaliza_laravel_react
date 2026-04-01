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
        // If stock hits below or equals min_stock and it was updated
        if ($item->wasChanged('quantity') && $item->quantity <= $item->min_stock) {
            // T12.9.3: use 'warning' type for low-stock alerts
            $this->notificationService->sendToRole(
                'admin',
                'Low Stock Alert',
                "Inventory item '{$item->name}' is running low (" . $item->quantity . " {$item->unit}). Please restock.",
                'warning'
            );
        }
    }
}
