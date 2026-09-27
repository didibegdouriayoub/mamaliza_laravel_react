<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FinishingLog extends Model
{
    protected $fillable = ['finished_product_id', 'pieces_produced', 'date', 'operator_id', 'notes'];

    protected $casts = ['pieces_produced' => 'integer'];

    public function product()
    {
        return $this->belongsTo(FinishedProduct::class, 'finished_product_id');
    }

    public function batchSources()
    {
        return $this->hasMany(FinishingLogBatch::class);
    }

    public function operator()
    {
        return $this->belongsTo(User::class, 'operator_id');
    }
}
