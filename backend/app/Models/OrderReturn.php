<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrderReturn extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'order_id',
        'order_item_id',
        'quantity',
        'reason',
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
}
