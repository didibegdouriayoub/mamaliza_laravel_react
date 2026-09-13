<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrderItem extends Model
{
    public $timestamps = false; // Add this since migration doesn't have timestamps()

    protected $casts = [
        'quantity' => 'float',
        'unit_price' => 'float',
        'total' => 'float',
    ];

    protected $fillable = [
        'order_id',
        'product_name',
        'quantity',
        'unit',
        'carton_id',
        'inventory_item_id',
        'unit_price',
        'total'
    ];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function carton()
    {
        return $this->belongsTo(PackagingCarton::class, 'carton_id');
    }

    public function inventoryItem()
    {
        return $this->belongsTo(InventoryItem::class, 'inventory_item_id');
    }

    /**
     * Piece-equivalent of this line's quantity, resolving the carton's
     * pieces_per_carton at read time so past sales stay accurate even if
     * the carton definition changes later.
     */
    public function piecesQuantity(): float
    {
        if ($this->unit === 'carton' && $this->carton) {
            return $this->quantity * $this->carton->pieces_per_carton;
        }

        return (float) $this->quantity;
    }
}
