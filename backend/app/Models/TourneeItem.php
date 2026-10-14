<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TourneeItem extends Model
{
    protected $fillable = ['tournee_id', 'finished_product_id', 'finished_goods_lot_id', 'qty_loaded', 'qty_returned', 'qty_lost'];

    protected $casts = ['qty_loaded' => 'float', 'qty_returned' => 'float', 'qty_lost' => 'float'];

    public function product()
    {
        return $this->belongsTo(FinishedProduct::class, 'finished_product_id');
    }

    public function lot()
    {
        return $this->belongsTo(FinishedGoodsLot::class, 'finished_goods_lot_id');
    }

    public function deliveries()
    {
        return $this->hasMany(TourneeDelivery::class);
    }

    /** Still with the worker: loaded - delivered - returned - lost. */
    public function remaining(): float
    {
        $delivered = $this->relationLoaded('deliveries') ? $this->deliveries->sum('qty') : $this->deliveries()->sum('qty');

        return round($this->qty_loaded - (float) $delivered - $this->qty_returned - $this->qty_lost, 4);
    }
}
