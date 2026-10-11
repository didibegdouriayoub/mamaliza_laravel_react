<?php

namespace App\Models\Concerns;

use App\Support\Money;

/**
 * Hides the attributes listed in $moneyFields from JSON / arrays for users without the money permission.
 * The values are still readable in PHP code (totals, stock logic keep working).
 */
trait HidesMoney
{
    public function getHidden()
    {
        $hidden = parent::getHidden();

        return Money::visible() ? $hidden : array_values(array_unique(array_merge($hidden, $this->moneyFields ?? [])));
    }
}
