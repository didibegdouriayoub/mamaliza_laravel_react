import { QualityControl } from '@/models/types';
import { mockQualityControls } from '@/data/mockData';

let controls = [...mockQualityControls];
const delay = (ms = 300) => new Promise(r => setTimeout(r, ms));

export const qualityService = {
  async getAll(): Promise<QualityControl[]> { await delay(); return [...controls]; },
  async getByBatchId(batchId: string): Promise<QualityControl | undefined> { await delay(); return controls.find(q => q.batchId === batchId); },
  async create(data: Omit<QualityControl, 'id' | 'evaluatedAt'>): Promise<QualityControl> {
    await delay();
    const newQc: QualityControl = { ...data, id: `qc${Date.now()}`, evaluatedAt: new Date().toISOString().split('T')[0] };
    controls.push(newQc);
    return newQc;
  },
  async delete(id: string): Promise<void> { await delay(); controls = controls.filter(q => q.id !== id); },
};
