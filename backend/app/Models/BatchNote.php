<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BatchNote extends Model
{
    protected $fillable = [
        'batch_id',
        'text',
        'author_id',
        'author'
    ];

    public function batch()
    {
        return $this->belongsTo(Batch::class);
    }

    public function authorUser()
    {
        return $this->belongsTo(User::class, 'author_id');
    }
}
