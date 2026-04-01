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

        // Deduct materials when batch moves to in_progress
        if ($batch->status === 'in_progress') {
            $this->inventoryService->deductForBatch($batch);
        }

        // T12.9.2: Notify admins when a batch fails
        if ($batch->status === 'failed') {
            $this->notificationService->sendToRole(
                'admin',
                'Batch Failed',
                "Batch #{$batch->id} ({$batch->recipe_name}) has been marked as failed.",
                'error'
            );
        }
    }
}
