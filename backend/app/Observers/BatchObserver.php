<?php

namespace App\Observers;

use App\Models\Batch;
use App\Services\InventoryService;

class BatchObserver
{
    protected InventoryService $inventoryService;

    public function __construct(InventoryService $inventoryService)
    {
        $this->inventoryService = $inventoryService;
    }

    public function updated(Batch $batch)
    {
        // Deduct materials if batch status changes to in_progress
        if ($batch->wasChanged('status') && $batch->status === 'in_progress') {
            $this->inventoryService->deductForBatch($batch);
        }
    }
}
