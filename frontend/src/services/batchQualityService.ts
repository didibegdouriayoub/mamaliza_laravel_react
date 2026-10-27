import { apiClient } from '../lib/apiClient';

export interface BatchQualityRecord {
  ph: number | null;
  peakTemp: number | null;
  waterKg: number | null;
  productionNotes: string | null;
  productionByName?: string | null;
  productionAt?: string | null;
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
}

export interface QualityFilters { date?: string; needs?: 'production'; limit?: number }

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
};
