<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BatchGroup extends Model
{
    protected $fillable = [
        'recipe_id', 'recipe_name', 'batch_count',
        'target_weight', 'piece_weight_value',
        'pieces_produced', 'leftover_qty', 'leftover_unit',
        'created_by',
    ];

    protected $casts = [
        'target_weight' => 'float',
        'piece_weight_value' => 'float',
        'pieces_produced' => 'float',
        'leftover_qty' => 'float',
        'batch_count' => 'integer',
    ];

    public function batches()
    {
        return $this->hasMany(Batch::class);
    }
}
