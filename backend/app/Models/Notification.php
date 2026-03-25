<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    protected $fillable = [
        'title',
        'message',
        'type',
        'target_roles',
        'target_user_id',
        'read_by'
    ];

    protected $casts = [
        'target_roles' => 'array',
        'read_by' => 'array',
    ];

    public function targetUser()
    {
        return $this->belongsTo(User::class, 'target_user_id');
    }
}
