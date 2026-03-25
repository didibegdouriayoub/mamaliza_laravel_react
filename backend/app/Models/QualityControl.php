<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QualityControl extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'batch_id',
        'taste',
        'texture',
        'smell',
        'overall_score',
        'approved',
        'evaluated_by',
        'evaluator',
        'notes',
        'evaluated_at'
    ];

    protected $casts = [
        'approved' => 'boolean',
        'evaluated_at' => 'date',
    ];

    public function batch()
    {
        return $this->belongsTo(Batch::class);
    }

    public function evaluatorUser()
    {
        return $this->belongsTo(User::class, 'evaluated_by');
    }
}
