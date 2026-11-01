import { apiClient } from '../lib/apiClient';

export interface BatchQualityRecord {
  ph: number | null;
  peakTemp: number | null;
  waterKg: number | null;
  productionNotes: string | null;
  productionByName?: string | null;
  productionAt?: string | null;
  outputKg?: number | null;
  outputNotes?: string | null;
  outputByName?: string | null;
  outputAt?: string | null;
  tastingScores?: Record<string, number | null> | null;
  tastingVerdict?: 'approved' | 'review' | 'rejected' | null;
  tastingNotes?: string | null;
  tastingByName?: string | null;
  tastingAt?: string | null;
}

/** Output stage numbers calculated by the server (only once the batch group is Done). */
export interface BatchOutput {
  available: boolean;
  reason: string | null;
  groupDoughKg: number | null;
  usedKg: number | null;
  leftoverKg: number | null;
  autoOutputKg: number | null;
  outputKg: number | null;
  isDefault: boolean;
  ingredientsKg: number;
  waterKg: number;
  steamKg: number | null;
  fatKg: number | null;
  proteinKg: number | null;
  fatPct: number | null;
  proteinPct: number | null;
  rework: { name: string; kg: number; missing: boolean }[];
  missingComposition: string[];
}

export interface RecipeTargets {
  id: number;
  name: string;
  cheeseType: 'mozzarella' | 'fondue' | null;
  targetTemp: number | null;
  phMin: number | null;
  phMax: number | null;
  defaultWaterKg: number | null;
  steps: string[] | null;
}

export interface QualityBatch {
  id: number;
  lot: string | null;
  recipeName: string;
  startedAt: string;
  batchGroupId: number | null;
  operatorName: string | null;
  inputMaterials?: { materialName?: string; quantity: number; unit?: string; lot?: string }[];
  recipe: RecipeTargets | null;
  quality: BatchQualityRecord | null;
  batchGroup?: { id: number; closedAt: string | null } | null;
  output?: BatchOutput;
}

export interface QualityFilters { date?: string; needs?: 'production' | 'tasting'; limit?: number }

export const batchQualityService = {
  list: (f: QualityFilters = {}): Promise<QualityBatch[]> => {
    const qs = new URLSearchParams();
    if (f.date) qs.set('date', f.date);
    if (f.needs) qs.set('needs', f.needs);
    if (f.limit) qs.set('limit', String(f.limit));
    const q = qs.toString();
    return apiClient.get(`/batch-quality${q ? `?${q}` : ''}`);
  },
  get: (batchId: number | string): Promise<QualityBatch> => apiClient.get(`/batch-quality/${batchId}`),
  saveProduction: (batchId: number | string, data: { ph: number | null; peakTemp: number | null; waterKg: number | null; productionNotes: string | null }) =>
    apiClient.put(`/batch-quality/${batchId}`, {
      ph: data.ph, peak_temp: data.peakTemp, water_kg: data.waterKg, production_notes: data.productionNotes,
    }),
  saveOutput: (batchId: number | string, data: { outputKg: number | null; outputNotes: string | null }) =>
    apiClient.put(`/batch-quality/${batchId}`, { output_kg: data.outputKg, output_notes: data.outputNotes }),
  saveTasting: (batchId: number | string, data: { scores: Record<string, number | null>; verdict: string | null; notes: string | null }) =>
    apiClient.put(`/batch-quality/${batchId}`, { tasting_scores: data.scores, tasting_verdict: data.verdict, tasting_notes: data.notes }),
};
