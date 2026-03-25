<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Supplier extends Model
{
    protected $fillable = ['name', 'contact', 'email'];

    public function inventoryItems()
    {
        return $this->hasMany(InventoryItem::class);
    }
}
