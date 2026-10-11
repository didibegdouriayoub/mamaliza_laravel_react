<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RecipeIngredient extends Model
{
    use \App\Models\Concerns\HidesMoney;

    /** Hidden from users without the money permission */
    protected array $moneyFields = ['unit_price'];

    public $timestamps = false;

    protected $fillable = [
        'recipe_id',
        'material_id',
        'material_name',
        'quantity',
        'unit',
        'unit_price'
    ];

    public function recipe()
    {
        return $this->belongsTo(Recipe::class);
    }

    public function material()
    {
        return $this->belongsTo(InventoryItem::class, 'material_id');
    }
}
