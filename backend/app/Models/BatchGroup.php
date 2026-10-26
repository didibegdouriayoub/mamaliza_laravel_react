<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BatchGroup extends Model
{
    protected $fillable = [
        'recipe_id', 'recipe_name', 'batch_count',
        'target_weight', 'piece_weight_value',
        'pieces_produced', 'leftover_qty', 'leftover_unit', 'closed_at',
        'created_by',
    ];

    protected $casts = [
        'target_weight' => 'float',
        'piece_weight_value' => 'float',
        'pieces_produced' => 'float',
        'leftover_qty' => 'float',
        'batch_count' => 'integer',
        'closed_at' => 'datetime',
    ];

    /** Dough produced by the mixes (target weight x number of batches), in kg */
    public function expectedKg(): float
    {
        return (float) $this->target_weight * (int) $this->batch_count;
    }

    /** Done once all its dough has been used by finishing logs. Returns true when it is (now) done. */
    public function closeIfUsedUp(): bool
    {
        if ($this->closed_at) {
            return true;
        }
        $used = (float) $this->finishingSources()->sum('kg_used');
        if ($this->expectedKg() > 0 && $used > 0 && $used >= $this->expectedKg() - 0.01) {
            $this->update(['closed_at' => now()]);
            return true;
        }

        return false;
    }

    /** Back to open when a deleted finishing log gives dough back (only if no leftover was recorded on close). */
    public function reopenIfDoughLeft(): void
    {
        if (!$this->closed_at || (float) $this->leftover_qty > 0) {
            return;
        }
        $used = (float) $this->finishingSources()->sum('kg_used');
        if ($this->expectedKg() > 0 && $used < $this->expectedKg() - 0.01) {
            $this->update(['closed_at' => null]);
        }
    }

    public function batches()
    {
        return $this->hasMany(Batch::class);
    }

    public function finishingSources()
    {
        return $this->hasMany(FinishingLogBatch::class);
    }

    public function recipe()
    {
        return $this->belongsTo(Recipe::class);
    }
}
