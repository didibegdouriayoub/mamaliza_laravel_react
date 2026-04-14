<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CartonMaterial extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'carton_id',
        'material_id',
        'amount_per_carton',
    ];

    public function material()
    {
        return $this->belongsTo(PackagingMaterial::class, 'material_id');
    }

    public function carton()
    {
        return $this->belongsTo(PackagingCarton::class, 'carton_id');
    }
}
