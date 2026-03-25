<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InventoryItem extends Model
{
    protected $fillable = [
        'name',
        'type',
        'quantity',
        'unit',
        'price',
        'supplier_id',
        'min_stock'
    ];

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function history()
    {
        return $this->hasMany(InventoryHistory::class, 'item_id');
    }
}
