<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PackagingCarton extends Model
{
    protected $casts = [
        'pieces_per_carton' => 'integer',
    ];

    protected $fillable = [
        'name',
        'product_name',
        'pieces_per_carton',
    ];

    public function cartonMaterials()
    {
        return $this->hasMany(CartonMaterial::class, 'carton_id')->with('material');
    }

    public function logs()
    {
        return $this->hasMany(PackagingLog::class, 'carton_id');
    }
}
