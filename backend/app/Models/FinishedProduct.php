<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FinishedProduct extends Model
{
    protected $fillable = ['name', 'type', 'unit_price', 'notes', 'image_path', 'lot_prefix', 'lot_letters'];

    protected $appends = ['image_url'];
    protected $hidden = ['image_path'];

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

    public function lots()
    {
        return $this->hasMany(FinishedGoodsLot::class);
    }

    /** Lots that still hold stock, oldest first (the order they should be sold). */
    public function availableLots()
    {
        return $this->lots()->where('qty_remaining', '>', 0)->orderBy('lot_date')->orderBy('id');
    }

    // Path relative to the API base URL, so it works behind the Vercel /api proxy too.
    public function getImageUrlAttribute(): ?string
    {
        return $this->image_path
            ? 'product-images/' . $this->id . '?v=' . ($this->updated_at?->timestamp ?? 0)
            : null;
    }
}
