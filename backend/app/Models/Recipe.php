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
        'steps',
        'target_weight',
        'piece_weight',
        'recipe_status',
        'packages',
        'version'
    ];

    protected $casts = [
        'steps' => 'array',
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
