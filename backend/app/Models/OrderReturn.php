<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrderReturn extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'order_id',
        'order_item_id',
        'product_name',
        'quantity',
        'unit',
        'carton_id',
        'inventory_item_id',
        'reason',
        'disposition',
        'refund_amount',
        'returned_at'
    ];

    protected $casts = [
        'returned_at' => 'datetime',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function item()
    {
        return $this->belongsTo(OrderItem::class, 'order_item_id');
    }

    public function carton()
    {
        return $this->belongsTo(PackagingCarton::class, 'carton_id');
    }

    public function inventoryItem()
    {
        return $this->belongsTo(InventoryItem::class, 'inventory_item_id');
    }

    public function piecesQuantity(): float
    {
        if ($this->unit === 'carton' && $this->carton) {
            return $this->quantity * $this->carton->pieces_per_carton;
        }

        return (float) $this->quantity;
    }
}
