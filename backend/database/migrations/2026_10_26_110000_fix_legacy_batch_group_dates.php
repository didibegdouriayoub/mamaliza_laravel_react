<?php

use Carbon\Carbon;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Legacy-imported batch groups took the legacy "created_at" as their date, which can be a different day
     * than the production date the lots (KRO-22092026-001) and the mixes carry. Put the group on the
     * production date, keeping its time of day.
     */
    public function up(): void
    {
        $groups = DB::table('batch_groups')->where('created_by', 'Legacy Import')->get(['id', 'created_at']);

        foreach ($groups as $g) {
            $date = DB::table('batches')->where('batch_group_id', $g->id)->min('started_at');
            if (!$date) {
                continue;
            }
            $current = Carbon::parse($g->created_at);
            if ($current->toDateString() === Carbon::parse($date)->toDateString()) {
                continue;
            }
            $fixed = Carbon::parse($date)->setTime($current->hour, $current->minute, $current->second)->toDateTimeString();
            DB::table('batch_groups')->where('id', $g->id)->update(['created_at' => $fixed, 'updated_at' => $fixed]);
        }
    }

    public function down(): void
    {
        // the previous (wrong) dates are not recoverable
    }
};
