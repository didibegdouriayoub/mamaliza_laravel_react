<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FinishedProductInput extends Model
{
    public $timestamps = false;
    protected $fillable = ['finished_product_id', 'recipe_id', 'kg_per_piece'];
    protected $casts = ['kg_per_piece' => 'float'];

    public function recipe()
    {
        return $this->belongsTo(Recipe::class);
    }
}
