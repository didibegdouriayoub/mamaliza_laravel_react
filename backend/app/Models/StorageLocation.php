<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StorageLocation extends Model
{
    protected $fillable = ['name', 'type', 'temperature_required', 'capacity'];

    public function productStorageLogs(): HasMany
    {
        return $this->hasMany(ProductStorageLog::class, 'location_id');
    }

    public function movementsFrom(): HasMany
    {
        return $this->hasMany(StorageMovement::class, 'from_location_id');
    }

    public function movementsTo(): HasMany
    {
        return $this->hasMany(StorageMovement::class, 'to_location_id');
    }
}
