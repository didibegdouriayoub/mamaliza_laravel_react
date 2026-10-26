<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrderReturn extends Model
{
    use \App\Models\Concerns\HidesMoney;

    /** Hidden from users without the money permission */
    protected array $moneyFields = ['refund_amount'];

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

    protected $appends = ['pieces'];

    protected $casts = [
        'returned_at' => 'datetime',
        'quantity' => 'float',
        'refund_amount' => 'float',
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

    public function getPiecesAttribute(): float
    {
        return $this->piecesQuantity();
    }

    /**
     * Quantity in pieces. unit 'loose' = loose pieces taken out of a box line; any other unit counts in the
     * line's own unit (boxes for a box line), which keeps returns recorded before 'loose' existed correct.
     */
    public function piecesQuantity(): float
    {
        if ($this->unit === 'loose') {
            return (float) $this->quantity;
        }

        $ppu = $this->item?->pieces_per_unit ?? 1;
        if ($ppu > 1) {
            return $this->quantity * $ppu;
        }

        if ($this->unit === 'carton' && $this->carton) {
            return $this->quantity * $this->carton->pieces_per_carton;
        }

        return (float) $this->quantity;
    }
}
