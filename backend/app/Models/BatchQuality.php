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
        'output_kg', 'output_notes', 'output_by_name', 'output_at',
        'tasting_scores', 'tasting_verdict', 'tasting_notes', 'tasting_by_name', 'tasting_at',
    ];

    protected $casts = [
        'ph' => 'float',
        'peak_temp' => 'float',
        'water_kg' => 'float',
        'production_at' => 'datetime',
        'output_kg' => 'float',
        'output_at' => 'datetime',
        'tasting_scores' => 'array',
        'tasting_at' => 'datetime',
    ];

    public function batch()
    {
        return $this->belongsTo(Batch::class);
    }
}
