<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StorageMovement extends Model
{
    protected $fillable = ['product_id', 'from_location_id', 'to_location_id', 'quantity', 'reason', 'operator_id'];

    public function fromLocation(): BelongsTo
    {
        return $this->belongsTo(StorageLocation::class, 'from_location_id');
    }

    public function toLocation(): BelongsTo
    {
        return $this->belongsTo(StorageLocation::class, 'to_location_id');
    }

    public function operator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'operator_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class, 'product_id');
    }
}
