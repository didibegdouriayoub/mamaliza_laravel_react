<?php

namespace App\Observers;

use App\Models\Batch;
use App\Services\InventoryService;
use App\Services\NotificationService;

class BatchObserver
{
    protected InventoryService $inventoryService;
    protected NotificationService $notificationService;

    public function __construct(InventoryService $inventoryService, NotificationService $notificationService)
    {
        $this->inventoryService = $inventoryService;
        $this->notificationService = $notificationService;
    }

    public function updated(Batch $batch)
    {
        if (!$batch->wasChanged('status')) {
            return;
        }

        if ($batch->status === 'failed') {
            // Auto-create leftover inventory item
            $date = now()->format('d-m-Y');
            $name = "LO-{$date}-{$batch->recipe_name}";
            \App\Models\InventoryItem::create([
                'name'        => $name,
                'type'        => 'leftover',
                'quantity'    => $batch->output_quantity ?? 0,
                'unit'        => $batch->output_unit ?? 'kg',
                'price'       => 0,
                'min_stock'   => 0,
                'supplier_id' => null,
            ]);

            $this->notificationService->sendToRole(
                'admin',
                'Batch Failed',
                "Batch #{$batch->id} ({$batch->recipe_name}) has been marked as failed. Leftover added to inventory.",
                'error'
            );
        }
    }
}
