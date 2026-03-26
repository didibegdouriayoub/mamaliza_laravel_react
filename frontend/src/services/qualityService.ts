import { apiClient } from '../lib/apiClient';
import { QualityControl } from '../models/types';

const toPayload = (e: Partial<QualityControl>) => ({
  batch_id: e.batchId,
  taste: e.taste,
  texture: e.texture,
  smell: e.smell,
  overall_score: e.overallScore,
  approved: e.approved,
  evaluated_by: e.evaluatedBy,
  evaluator: e.evaluator,
  notes: e.notes,
  evaluated_at: e.evaluatedAt,
});

export const qualityService = {
  getAll: () => apiClient.get('/quality-controls'),
  getById: (id: string | number) => apiClient.get(`/quality-controls/${id}`),
  create: (evalData: Partial<QualityControl>) => apiClient.post('/quality-controls', toPayload(evalData)),
  update: (id: string | number, evalData: Partial<QualityControl>) => apiClient.put(`/quality-controls/${id}`, toPayload(evalData)),
  delete: (id: string | number) => apiClient.delete(`/quality-controls/${id}`),
};
