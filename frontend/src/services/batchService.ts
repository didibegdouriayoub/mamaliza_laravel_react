import { Batch, BatchNote } from '@/models/types';
import { mockBatches } from '@/data/mockData';

let batches = [...mockBatches];
const delay = (ms = 300) => new Promise(r => setTimeout(r, ms));

export const batchService = {
  async getAll(): Promise<Batch[]> { await delay(); return [...batches]; },
  async getById(id: string): Promise<Batch | undefined> { await delay(); return batches.find(b => b.id === id); },
  async create(batch: Omit<Batch, 'id' | 'startedAt'>): Promise<Batch> {
    await delay();
    const newBatch: Batch = { ...batch, id: `b${Date.now()}`, startedAt: new Date().toISOString().split('T')[0] };
    batches.push(newBatch);
    return newBatch;
  },
  async update(id: string, updates: Partial<Batch>): Promise<Batch> {
    await delay();
    const idx = batches.findIndex(b => b.id === id);
    if (idx === -1) throw new Error('Batch not found');
    batches[idx] = { ...batches[idx], ...updates };
    return batches[idx];
  },
  async delete(id: string): Promise<void> { await delay(); batches = batches.filter(b => b.id !== id); },
  async addNote(id: string, text: string, author: string): Promise<BatchNote> {
    await delay();
    const batch = batches.find(b => b.id === id);
    if (!batch) throw new Error('Batch not found');
    const note: BatchNote = { id: `n${Date.now()}`, text, author, createdAt: new Date().toISOString().split('T')[0] };
    batch.notes.push(note);
    return note;
  },
};
