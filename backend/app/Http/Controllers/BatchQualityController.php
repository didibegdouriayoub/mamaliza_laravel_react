<?php

namespace App\Http\Controllers;

use App\Models\Batch;
use App\Models\BatchQuality;
use Illuminate\Http\Request;

class BatchQualityController extends Controller
{
    private const RECIPE_COLUMNS = 'id,name,cheese_type,target_temp,ph_min,ph_max,default_water_kg,steps';

    /**
     * Batches with their quality record and the recipe targets.
     * ?date=YYYY-MM-DD (production day), ?needs=production (pH not entered yet), ?limit=N (default 300, newest first)
     */
    public function index(Request $request)
    {
        $query = Batch::with(['recipe:' . self::RECIPE_COLUMNS, 'quality'])
            ->orderByDesc('started_at')->orderByDesc('id');

        if ($request->filled('date')) {
            $query->whereDate('started_at', $request->input('date'));
        }
        if ($request->input('needs') === 'production') {
            $query->whereDoesntHave('quality', fn ($q) => $q->whereNotNull('ph'));
        }

        $limit = min(1000, max(1, (int) $request->input('limit', 300)));

        return response()->json(
            $query->limit($limit)->get()->each->makeHidden(['input_materials'])->values()
        );
    }

    // One batch: ingredients (read-only), recipe targets and steps, quality record.
    public function show(Batch $batch)
    {
        return response()->json($batch->load(['recipe:' . self::RECIPE_COLUMNS, 'quality']));
    }

    // Save the production stage (called on every autosave). Date and operator come from the logged-in user.
    public function update(Request $request, Batch $batch)
    {
        $validated = $request->validate([
            'ph'               => 'nullable|numeric|min:0|max:14',
            'peak_temp'        => 'nullable|numeric|min:0|max:200',
            'water_kg'         => 'nullable|numeric|min:0',
            'production_notes' => 'nullable|string|max:2000',
        ]);

        $quality = BatchQuality::firstOrNew(['batch_id' => $batch->id]);
        $quality->fill($validated);

        if (!$quality->exists || !$quality->production_at) {
            $quality->production_by = $request->user()?->id;
            $quality->production_by_name = $request->user()?->name;
            $quality->production_at = now();
        }
        $quality->save();

        return response()->json($quality);
    }
}
