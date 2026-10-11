<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

/**
 * Sequential document numbers, one sequence per type and year: FA-2026-0001, DV-2026-0001.
 * Call inside the DB transaction that creates the document, so a failed save never burns a number.
 */
class DocumentNumberService
{
    public function next(string $type, ?int $year = null): string
    {
        $type = $type === 'devis' ? 'devis' : 'facture';
        $year ??= (int) now()->format('Y');

        $row = DB::table('document_counters')->where('type', $type)->where('year', $year)->lockForUpdate()->first();
        if (!$row) {
            DB::table('document_counters')->insert(['type' => $type, 'year' => $year, 'last' => 0]);
            $row = DB::table('document_counters')->where('type', $type)->where('year', $year)->lockForUpdate()->first();
        }

        $next = $row->last + 1;
        DB::table('document_counters')->where('id', $row->id)->update(['last' => $next]);

        return ($type === 'devis' ? 'DV' : 'FA') . '-' . $year . '-' . str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
