<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RecipeHistory extends Model
{
    protected $table = 'recipe_history';

    public const UPDATED_AT = null;
    public const CREATED_AT = null;

    protected $fillable = [
        'recipe_id',
        'field',
        'old_value',
        'new_value',
        'changed_by',
        'changed_at',
    ];

    protected $casts = [
        'changed_at' => 'datetime',
    ];

    public function recipe()
    {
        return $this->belongsTo(Recipe::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
