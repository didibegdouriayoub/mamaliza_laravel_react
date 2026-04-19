<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductStorageLog extends Model
{
    protected $fillable = ['product_id', 'batch_id', 'location_id', 'quantity', 'entry_date', 'status'];

    public function location(): BelongsTo
    {
        return $this->belongsTo(StorageLocation::class, 'location_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class, 'product_id');
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class, 'batch_id');
    }
}
