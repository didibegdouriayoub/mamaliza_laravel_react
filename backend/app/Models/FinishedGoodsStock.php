<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FinishedGoodsStock extends Model
{
    protected $table = 'finished_goods_stock';
    protected $fillable = ['finished_product_id', 'quantity'];
    protected $casts = ['quantity' => 'float'];

    public function product()
    {
        return $this->belongsTo(FinishedProduct::class, 'finished_product_id');
    }
}
