<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrderItem extends Model
{
    use \App\Models\Concerns\HidesMoney;

    /** Hidden from users without the money permission */
    protected array $moneyFields = ['unit_price', 'total'];

    public $timestamps = false; // Add this since migration doesn't have timestamps()

    protected $casts = [
        'quantity' => 'float',
        'unit_price' => 'float',
        'total' => 'float',
    ];

    protected $appends = ['pieces_per_unit'];

    protected $fillable = [
        'order_id',
        'product_name',
        'quantity',
        'unit',
        'carton_id',
        'inventory_item_id',
        'finished_product_id',
        'unit_price',
        'total'
    ];

    /** The piece product packed in this line's product when it is a box product (null for plain pieces) */
    public function boxComponent()
    {
        return $this->hasOne(FinishedProductComponent::class, 'finished_product_id', 'finished_product_id')->orderBy('id');
    }

    /** Pieces in one sold unit: pieces per box for a box product, pieces per carton for a carton line, else 1 */
    public function getPiecesPerUnitAttribute(): float
    {
        if ($this->finished_product_id && $this->boxComponent && $this->boxComponent->qty_per_box > 0) {
            return (float) $this->boxComponent->qty_per_box;
        }

        if ($this->unit === 'carton' && $this->carton) {
            return (float) $this->carton->pieces_per_carton;
        }

        return 1.0;
    }

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
        return $this->quantity * $this->pieces_per_unit;
    }
}
