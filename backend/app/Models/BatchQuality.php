<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BatchQuality extends Model
{
    protected $table = 'batch_quality';

    protected $fillable = [
        'batch_id',
        'ph', 'peak_temp', 'water_kg', 'production_notes',
        'production_by', 'production_by_name', 'production_at',
    ];

    protected $casts = [
        'ph' => 'float',
        'peak_temp' => 'float',
        'water_kg' => 'float',
        'production_at' => 'datetime',
    ];

    public function batch()
    {
        return $this->belongsTo(Batch::class);
    }
}
