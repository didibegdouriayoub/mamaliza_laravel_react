import { apiClient } from '../lib/apiClient';
import { Batch } from '../models/types';

const toPayload = (b: Partial<Batch>) => ({
  recipe_id: b.recipeId,
  recipe_name: b.recipeName,
  status: b.status,
  input_materials: b.inputMaterials,
  output_quantity: b.outputQuantity,
  output_unit: b.outputUnit,
  quality_score: b.qualityScore,
  operator_id: b.operatorId,
  operator_name: b.operatorName,
  started_at: b.startedAt,
  completed_at: b.completedAt,
});

export const batchService = {
  getAll: () => apiClient.get('/batches'),
  getById: (id: string | number) => apiClient.get(`/batches/${id}`),
  create: (batch: Partial<Batch>) => apiClient.post('/batches', toPayload(batch)),
  update: (id: string | number, batch: Partial<Batch>) => apiClient.put(`/batches/${id}`, toPayload(batch)),
  delete: (id: string | number) => apiClient.delete(`/batches/${id}`),
  addNote: (id: string | number, note: any) => apiClient.post(`/batches/${id}/notes`, note),
};
