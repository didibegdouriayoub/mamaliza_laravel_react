<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TourneeDelivery extends Model
{
    protected $fillable = ['tournee_item_id', 'order_id', 'order_item_id', 'qty'];

    protected $casts = ['qty' => 'float'];
}
