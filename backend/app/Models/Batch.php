<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Batch extends Model
{
    public $timestamps = false; // Batches use started_at and completed_at, not created_at/updated_at. Or we can use them but schema didn't have created_at explicitly except what Laravel expects. Wait, schema actually didn't have timestamps() for batches in database-schema.md, but maybe I added it. I'll just use what's there.

    protected $fillable = [
        'recipe_id',
        'recipe_name',
        'status',
        'input_materials',
        'output_quantity',
        'output_unit',
        'quality_score',
        'operator_id',
        'operator_name',
        'started_at',
        'completed_at'
    ];

    protected $casts = [
        'input_materials' => 'array',
        'started_at' => 'date',
        'completed_at' => 'date',
    ];

    public function recipe()
    {
        return $this->belongsTo(Recipe::class);
    }

    public function operator()
    {
        return $this->belongsTo(User::class, 'operator_id');
    }

    public function notes()
    {
        return $this->hasMany(BatchNote::class);
    }

    public function qualityControl()
    {
        return $this->hasOne(QualityControl::class);
    }
}
