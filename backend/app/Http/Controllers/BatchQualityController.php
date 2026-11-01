<?php

namespace App\Http\Controllers;

use App\Models\Batch;
use App\Models\BatchQuality;
use App\Services\BatchOutputService;
use Illuminate\Http\Request;

class BatchQualityController extends Controller
{
    private const RECIPE_COLUMNS = 'id,name,cheese_type,target_temp,ph_min,ph_max,default_water_kg,steps';

    /**
     * Batches with their quality record and the recipe targets.
     * ?date=YYYY-MM-DD (production day), ?needs=production (pH not entered yet) or ?needs=tasting (no scores yet), ?tasted=1 (scored only), ?ingredients=1 (include the ingredient list), ?limit=N (default 300, newest first)
     */
    public function index(Request $request)
    {
        $query = Batch::with(['recipe:' . self::RECIPE_COLUMNS, 'quality', 'batchGroup:id,closed_at'])
            ->orderByDesc('started_at')->orderByDesc('id');

        if ($request->filled('date')) {
            $query->whereDate('started_at', $request->input('date'));
        }
        if ($request->input('needs') === 'production') {
            $query->whereDoesntHave('quality', fn ($q) => $q->whereNotNull('ph'));
        }
        if ($request->input('needs') === 'tasting') {
            $query->whereDoesntHave('quality', fn ($q) => $q->whereNotNull('tasting_scores'));
        }

        if ($request->boolean('tasted')) {
            $query->whereHas('quality', fn ($q) => $q->whereNotNull('tasting_scores'));
        }

        $limit = min(1000, max(1, (int) $request->input('limit', 300)));

        $rows = $query->limit($limit)->get();
        // ingredients are only sent when asked for (the Best batches tab)
        if (!$request->boolean('ingredients')) {
            $rows->each->makeHidden(['input_materials']);
        }

        return response()->json($rows->values());
    }

    // One batch: ingredients (read-only), recipe targets and steps, quality record.
    public function show(Batch $batch)
    {
        $batch->load(['recipe:' . self::RECIPE_COLUMNS, 'quality']);

        return response()->json(array_merge($batch->toArray(), [
            'output' => app(BatchOutputService::class)->forBatch($batch),
        ]));
    }

    // Save one stage (called on every autosave). Date and operator come from the logged-in user.
    // Only the fields sent are changed, so each stage saves on its own.
    public function update(Request $request, Batch $batch)
    {
        $scoreRule = 'nullable|integer|min:1|max:5';
        $validated = $request->validate([
            'ph'               => 'sometimes|nullable|numeric|min:0|max:14',
            'peak_temp'        => 'sometimes|nullable|numeric|min:0|max:200',
            'water_kg'         => 'sometimes|nullable|numeric|min:0',
            'production_notes' => 'sometimes|nullable|string|max:2000',
            'output_kg'        => 'sometimes|nullable|numeric|min:0',
            'output_notes'     => 'sometimes|nullable|string|max:2000',
            'tasting_scores'   => 'sometimes|nullable|array',
            'tasting_scores.taste'       => $scoreRule,
            'tasting_scores.texture'     => $scoreRule,
            'tasting_scores.stretch'     => $scoreRule,
            'tasting_scores.melt'        => $scoreRule,
            'tasting_scores.creaminess'  => $scoreRule,
            'tasting_scores.smoothness'  => $scoreRule,
            'tasting_verdict'  => 'sometimes|nullable|in:approved,review,rejected',
            'tasting_notes'    => 'sometimes|nullable|string|max:2000',
        ]);

        $quality = BatchQuality::firstOrNew(['batch_id' => $batch->id]);
        $quality->fill($validated);

        $user = $request->user();
        $touched = fn (string ...$keys) => count(array_intersect($keys, array_keys($validated))) > 0;
        if ($touched('ph', 'peak_temp', 'water_kg', 'production_notes') && !$quality->production_at) {
            $quality->production_by = $user?->id;
            $quality->production_by_name = $user?->name;
            $quality->production_at = now();
        }
        if ($touched('output_kg', 'output_notes') && !$quality->output_at) {
            $quality->output_by_name = $user?->name;
            $quality->output_at = now();
        }
        if ($touched('tasting_scores', 'tasting_verdict', 'tasting_notes') && !$quality->tasting_at) {
            $quality->tasting_by_name = $user?->name;
            $quality->tasting_at = now();
        }
        $quality->save();

        return response()->json($quality);
    }
}
