<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrderItem extends Model
{
    public $timestamps = false; // Add this since migration doesn't have timestamps()

    protected $fillable = [
        'order_id',
        'product_name',
        'quantity',
        'unit_price',
        'total'
    ];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }
}
