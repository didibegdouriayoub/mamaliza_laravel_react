<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProductionLog extends Model
{
    protected $fillable = [
        'date',
        'totals',
        'batch_id',
        'recipe_name',
        'operator_id',
        'operator_name',
        'produced_pieces',
        'unit',
        'notes',
        'logged_at'
    ];

    protected $casts = [
        'date' => 'date',
        'logged_at' => 'date',
        'totals' => 'array',
        'produced_pieces' => 'decimal:3',
    ];

    public function leftovers()
    {
        return $this->hasMany(ProductionLogLeftover::class, 'log_id');
    }
}
