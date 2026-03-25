<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InventoryHistory extends Model
{
    protected $table = 'inventory_history';

    public const UPDATED_AT = null; // We only use changed_at, no updated_at column is needed.
    public const CREATED_AT = null; // We use changed_at

    protected $fillable = [
        'item_id',
        'field',
        'old_value',
        'new_value',
        'changed_by',
        'changed_at',
    ];

    protected $casts = [
        'changed_at' => 'datetime',
    ];

    public function item()
    {
        return $this->belongsTo(InventoryItem::class, 'item_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
