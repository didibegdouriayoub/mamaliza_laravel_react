<?php

namespace App\Observers;

use App\Models\Batch;
use App\Models\InventoryHistory;
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

    public function created(Batch $batch): void
    {
        if ($batch->status === 'completed') {
            $this->deductEmballage($batch);
        }
    }

    public function updated(Batch $batch): void
    {
        if (!$batch->wasChanged('status')) {
            return;
        }

        if ($batch->status === 'completed') {
            $this->deductEmballage($batch);
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
                'min_stock'   => 1,
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

    private function deductEmballage(Batch $batch): void
    {
        $recipe = \App\Models\Recipe::find($batch->recipe_id);
        if (!$recipe || empty($recipe->packages)) {
            return;
        }

        $pieces = (float) $batch->output_quantity;
        if ($pieces <= 0) {
            return;
        }

        foreach ($recipe->packages as $pkg) {
            $itemId  = $pkg['id'] ?? null;
            $perUnit = (float) ($pkg['quantity'] ?? 0);
            if (!$itemId || $perUnit <= 0) continue;

            $item = \App\Models\InventoryItem::find($itemId);
            if (!$item) continue;

            $consumed = $perUnit * $pieces;
            $oldQty   = (float) $item->quantity;
            $newQty   = max(0, $oldQty - $consumed);

            $item->update(['quantity' => $newQty]);

            \App\Models\InventoryHistory::create([
                'item_id'    => $item->id,
                'field'      => 'quantity',
                'old_value'  => (string) $oldQty,
                'new_value'  => (string) $newQty,
                'changed_by' => $batch->operator_id,
            ]);
        }
    }
}
