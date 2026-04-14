<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PackagingMaterial extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'name',
        'code',
        'type',
        'stock_qty',
        'stock_unit',
        'low_stock_alert',
        'account_code',
        'dim_length',
        'dim_width',
        'dim_height',
        'notes',
    ];

    protected $dates = ['last_updated', 'created_at'];

    public function cartonMaterials()
    {
        return $this->hasMany(CartonMaterial::class, 'material_id');
    }
}
