<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FinishedProduct extends Model
{
    protected $fillable = ['name', 'type', 'unit_price', 'notes'];

    protected $casts = [
        'unit_price' => 'float',
    ];

    public function inputs()
    {
        return $this->hasMany(FinishedProductInput::class);
    }

    public function materials()
    {
        return $this->hasMany(FinishedProductMaterial::class);
    }

    public function components()
    {
        return $this->hasMany(FinishedProductComponent::class);
    }

    public function stock()
    {
        return $this->hasOne(FinishedGoodsStock::class);
    }
}
