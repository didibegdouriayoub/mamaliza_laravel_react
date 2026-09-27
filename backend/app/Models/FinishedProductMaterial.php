<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FinishedProductMaterial extends Model
{
    public $timestamps = false;
    protected $fillable = ['finished_product_id', 'inventory_item_id', 'qty_per_piece'];
    protected $casts = ['qty_per_piece' => 'float'];

    public function inventoryItem()
    {
        return $this->belongsTo(InventoryItem::class);
    }
}
