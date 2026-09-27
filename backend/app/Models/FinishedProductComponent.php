<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FinishedProductComponent extends Model
{
    public $timestamps = false;
    protected $fillable = ['finished_product_id', 'component_id', 'qty_per_box'];
    protected $casts = ['qty_per_box' => 'float'];

    public function component()
    {
        return $this->belongsTo(FinishedProduct::class, 'component_id');
    }
}
