<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FinishedGoodsMovement extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'finished_product_id', 'finished_goods_lot_id', 'type', 'quantity', 'reason',
        'order_id', 'order_item_id', 'finishing_log_id', 'user_id', 'created_at',
    ];

    protected $casts = ['quantity' => 'float', 'created_at' => 'datetime'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function lot()
    {
        return $this->belongsTo(FinishedGoodsLot::class, 'finished_goods_lot_id');
    }
}
