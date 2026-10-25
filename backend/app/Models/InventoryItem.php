<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InventoryItem extends Model
{
    use \App\Models\Concerns\HidesMoney;

    /** Hidden from users without the money permission */
    protected array $moneyFields = ['price'];

    protected $casts = [
        'quantity' => 'float',
        'price' => 'float',
        'min_stock' => 'float',
        'best_before' => 'date:Y-m-d',
    ];

    protected $fillable = [
        'name',
        'type',
        'quantity',
        'unit',
        'price',
        'supplier_id',
        'lot',
        'best_before',
        'code',
        'min_stock',
        'lead_time_days',
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
