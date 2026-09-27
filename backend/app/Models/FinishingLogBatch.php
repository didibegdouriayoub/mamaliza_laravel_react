<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FinishingLogBatch extends Model
{
    public $timestamps = false;
    protected $fillable = ['finishing_log_id', 'batch_group_id', 'kg_used'];
    protected $casts = ['kg_used' => 'float'];

    public function batchGroup()
    {
        return $this->belongsTo(BatchGroup::class);
    }
}
