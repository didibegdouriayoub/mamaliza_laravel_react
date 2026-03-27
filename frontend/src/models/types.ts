// ============ ENUMS ============
export type UserRole = 'admin' | 'supervisor' | 'operator';

export type Permission =
  | 'inventory.read' | 'inventory.write'
  | 'recipes.read' | 'recipes.write'
  | 'batches.read' | 'batches.write'
  | 'quality.read' | 'quality.write'
  | 'sales.read' | 'sales.write'
  | 'users.read' | 'users.write'
  | 'suppliers.read' | 'suppliers.write'
  | 'customers.read' | 'customers.write'
  | 'analytics.read'
  | 'permissions.read' | 'permissions.write'
  | 'packaging.read' | 'packaging.write';

export type MaterialType = 'raw' | 'packaging';
export type BatchStatus = 'draft' | 'in_production' | 'completed' | 'failed';
export type OrderStatus = 'pending' | 'partial' | 'paid' | 'shipped' | 'cancelled';

// ============ CHANGE HISTORY ============
export interface ChangeRecord {
  id: string;
  field: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  changedAt: string;
}

// ============ ENTITIES ============
export interface PermissionEntity {
  id: string | number;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  permissions: Permission[];
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  email: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  type: MaterialType;
  quantity: number;
  unit: string;
  price: number;
  supplier: string;
  supplierId: string;
  lot?: string;
  code?: string;
  status: 'ok' | 'low' | 'out';
  minStock: number;
  createdAt: string;
  updatedAt: string;
  history?: ChangeRecord[];
}

export interface RecipeIngredient {
  materialId: string;
  materialName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  targetWeight: number;
  pieceWeight: string;   // Keeping as string to match old yield_unit type, can be weight e.g. "500g"
  recipeStatus: 'semi_final' | 'final';
  packages: Array<{ id: string; name: string; quantity: number }>;
  steps: string[];
  ingredients: RecipeIngredient[];
  version: number;
  createdAt: string;
  updatedAt: string;
  history?: ChangeRecord[];
}

export interface BatchNote {
  id: string;
  text: string;
  author: string;
  createdAt: string;
}

export interface Batch {
  id: string;
  recipeId: string;
  recipeName: string;
  status: BatchStatus;
  inputMaterials: RecipeIngredient[];
  outputQuantity: number;
  outputUnit: string;
  qualityScore?: number;
  notes: BatchNote[];
  startedAt: string;
  completedAt?: string;
  operatorId: string;
  operatorName: string;
}

export interface QualityControl {
  id: string;
  batchId: string;
  taste: number;
  texture: number;
  smell: number;
  overallScore: number;
  approved: boolean;
  evaluatedBy: string | number;
  evaluator: string;
  evaluatedAt: string;
  notes: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
}

export interface OrderItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Payment {
  id: string;
  amount: number;
  date: string;
  method: string;
}

export interface ReturnItem {
  id: string;
  productName: string;
  quantity: number;
  reason: string;
  refundAmount: number;
  date: string;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  items: OrderItem[];
  totalAmount: number;
  amountPaid: number;
  amountReturned: number;
  status: OrderStatus;
  payments: Payment[];
  returns: ReturnItem[];
  createdAt: string;
  paidAt?: string;
}

export interface Notification {
  id: string | number;
  title: string;
  message: string;
  type: 'warning' | 'error' | 'info' | 'success';
  readBy?: (string | number)[];
  createdAt: string;
}
