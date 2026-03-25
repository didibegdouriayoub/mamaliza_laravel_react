<?php

namespace App\Observers;

use App\Models\QualityControl;

class QualityControlObserver
{
    public function saved(QualityControl $qc)
    {
        // Sync the overall_score to the associated Batch's quality_score
        $batch = $qc->batch;
        if ($batch) {
            $batch->quality_score = $qc->overall_score;
            $batch->saveQuietly(); // Use saveQuietly to prevent triggering BatchObserver recursively
        }
    }
}
