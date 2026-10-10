<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FinishedGoodsLot extends Model
{
    protected $fillable = [
        'finished_product_id', 'finishing_log_id', 'lot_date', 'lot_code',
        'qty_produced', 'qty_remaining', 'is_opening',
    ];

    protected $casts = [
        'qty_produced'  => 'float',
        'qty_remaining' => 'float',
        'is_opening'    => 'boolean',
        'lot_date'      => 'date:Y-m-d',
    ];

    public function product()
    {
        return $this->belongsTo(FinishedProduct::class, 'finished_product_id');
    }

    public function finishingLog()
    {
        return $this->belongsTo(FinishingLog::class);
    }
}
