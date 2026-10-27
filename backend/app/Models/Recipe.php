<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Recipe extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name',
        'description',
        'cheese_type',
        'target_temp',
        'ph_min',
        'ph_max',
        'default_water_kg',
        'steps',
        'target_weight',
        'recipe_status',
        'packages',
        'version'
    ];

    protected $casts = [
        'steps' => 'array',
        'target_temp' => 'float',
        'ph_min' => 'float',
        'ph_max' => 'float',
        'default_water_kg' => 'float',
        'packages' => 'array',
    ];

    public function ingredients()
    {
        return $this->hasMany(RecipeIngredient::class);
    }

    public function history()
    {
        return $this->hasMany(RecipeHistory::class);
    }

    public function batches()
    {
        return $this->hasMany(Batch::class);
    }
}
