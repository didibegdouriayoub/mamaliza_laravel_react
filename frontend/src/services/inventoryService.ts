import { InventoryItem } from '@/models/types';
import { mockInventory } from '@/data/mockData';

let inventory = [...mockInventory];

const delay = (ms = 300) => new Promise(r => setTimeout(r, ms));

export const inventoryService = {
  async getAll(): Promise<InventoryItem[]> {
    await delay();
    return [...inventory];
  },
  async getById(id: string): Promise<InventoryItem | undefined> {
    await delay();
    return inventory.find(i => i.id === id);
  },
  async create(item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<InventoryItem> {
    await delay();
    const newItem: InventoryItem = {
      ...item,
      id: `i${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };
    inventory.push(newItem);
    return newItem;
  },
  async update(id: string, updates: Partial<InventoryItem>): Promise<InventoryItem> {
    await delay();
    const idx = inventory.findIndex(i => i.id === id);
    if (idx === -1) throw new Error('Item not found');
    inventory[idx] = { ...inventory[idx], ...updates, updatedAt: new Date().toISOString().split('T')[0] };
    return inventory[idx];
  },
  async delete(id: string): Promise<void> {
    await delay();
    inventory = inventory.filter(i => i.id !== id);
  },
};
