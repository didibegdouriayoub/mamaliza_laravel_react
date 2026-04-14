<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PackagingLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'carton_id',
        'date',
        'cartons_count',
        'loose_pieces',
        'notes',
    ];

    protected $dates = ['date', 'created_at'];

    public function carton()
    {
        return $this->belongsTo(PackagingCarton::class, 'carton_id');
    }
}
