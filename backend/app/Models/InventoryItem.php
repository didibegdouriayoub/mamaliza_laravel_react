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
        'lot',
        'code',
        'min_stock',
        'status',
    ];

    public static function booted()
    {
        static::saving(function ($item) {
            // Auto-calculate status based on quantity and min_stock
            if ($item->quantity <= 0) {
                $item->status = 'out';
            } elseif ($item->min_stock > 0 && $item->quantity <= $item->min_stock) {
                $item->status = 'low';
            } else {
                $item->status = 'ok';
            }
        });
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function history()
    {
        return $this->hasMany(InventoryHistory::class, 'item_id');
    }
}
