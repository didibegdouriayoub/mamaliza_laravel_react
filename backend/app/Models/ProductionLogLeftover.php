<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProductionLogLeftover extends Model
{
    protected $fillable = [
        'log_id',
        'item',
        'amount',
        'unit',
        'notes'
    ];

    public function productionLog()
    {
        return $this->belongsTo(ProductionLog::class, 'log_id');
    }
}
