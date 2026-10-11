<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    use \App\Models\Concerns\HidesMoney;

    /** Hidden from users without the money permission */
    protected array $moneyFields = ['amount'];

    public $timestamps = false;
    
    // Payments migration has created_at but not updated_at so we handle it this way
    public const UPDATED_AT = null;

    protected $fillable = [
        'order_id',
        'amount',
        'method',
        'paid_at',
        'created_at'
    ];

    protected $casts = [
        'paid_at' => 'date',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }
}
