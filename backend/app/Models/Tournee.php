<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Tournee extends Model
{
    protected $fillable = ['worker_name', 'date', 'status', 'notes', 'created_by', 'closed_at'];

    protected $casts = ['date' => 'date:Y-m-d', 'closed_at' => 'datetime'];

    public function items()
    {
        return $this->hasMany(TourneeItem::class);
    }

    public function orders()
    {
        return $this->hasMany(Order::class);
    }
}
