<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProductionLog extends Model
{
    protected $fillable = [
        'date',
        'totals'
    ];

    protected $casts = [
        'date' => 'date',
        'totals' => 'array',
    ];

    public function leftovers()
    {
        return $this->hasMany(ProductionLogLeftover::class, 'log_id');
    }
}
