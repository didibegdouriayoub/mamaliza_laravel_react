import {
  User, Supplier, InventoryItem, Recipe, Batch, QualityControl,
  Customer, Order, Notification
} from '@/models/types';

export const mockUsers: User[] = [
  {
    id: 'u1', name: 'Marie Dupont', email: 'marie@fromagerie.com', role: 'admin',
    permissions: ['manage_inventory', 'manage_recipes', 'manage_batches', 'manage_sales', 'view_analytics', 'manage_quality', 'manage_packaging', 'manage_users'],
  },
  {
    id: 'u2', name: 'Jean Petit', email: 'jean@fromagerie.com', role: 'supervisor',
    permissions: ['manage_inventory', 'manage_recipes', 'manage_batches', 'view_analytics', 'manage_quality'],
  },
  {
    id: 'u3', name: 'Sophie Martin', email: 'sophie@fromagerie.com', role: 'operator',
    permissions: ['manage_batches', 'manage_quality'],
  },
];

export const mockUser: User = mockUsers[0];

export const mockSuppliers: Supplier[] = [
  { id: 's1', name: 'Ferme du Vallon', contact: 'Jean Petit', email: 'jean@vallon.fr' },
  { id: 's2', name: 'Laiterie des Alpes', contact: 'Sophie Martin', email: 'sophie@alpes.fr' },
  { id: 's3', name: 'PackPro SAS', contact: 'Luc Bernard', email: 'luc@packpro.fr' },
];

export const mockInventory: InventoryItem[] = [
  { id: 'i1', name: 'Whole Milk', type: 'raw', quantity: 2500, unit: 'liters', price: 0.85, supplier: 'Ferme du Vallon', supplierId: 's1', minStock: 500, createdAt: '2025-01-10', updatedAt: '2025-03-20', history: [
    { id: 'h1', field: 'quantity', oldValue: '1500', newValue: '2000', changedBy: 'Marie Dupont', changedAt: '2025-02-15' },
    { id: 'h2', field: 'quantity', oldValue: '2000', newValue: '2500', changedBy: 'Marie Dupont', changedAt: '2025-03-20' },
    { id: 'h3', field: 'price', oldValue: '0.80', newValue: '0.85', changedBy: 'Jean Petit', changedAt: '2025-03-01' },
  ] },
  { id: 'i2', name: 'Rennet', type: 'raw', quantity: 15, unit: 'liters', price: 45.00, supplier: 'Laiterie des Alpes', supplierId: 's2', minStock: 5, createdAt: '2025-01-10', updatedAt: '2025-03-18', history: [
    { id: 'h4', field: 'quantity', oldValue: '20', newValue: '15', changedBy: 'Marie Dupont', changedAt: '2025-03-18' },
  ] },
  { id: 'i3', name: 'Salt', type: 'raw', quantity: 200, unit: 'kg', price: 0.50, supplier: 'Ferme du Vallon', supplierId: 's1', minStock: 50, createdAt: '2025-01-10', updatedAt: '2025-03-15', history: [
    { id: 'h5', field: 'quantity', oldValue: '250', newValue: '200', changedBy: 'Sophie Martin', changedAt: '2025-03-15' },
  ] },
  { id: 'i4', name: 'Cultures', type: 'raw', quantity: 8, unit: 'kg', price: 120.00, supplier: 'Laiterie des Alpes', supplierId: 's2', minStock: 3, createdAt: '2025-02-01', updatedAt: '2025-03-20', history: [
    { id: 'h6', field: 'price', oldValue: '110.00', newValue: '120.00', changedBy: 'Jean Petit', changedAt: '2025-03-10' },
  ] },
  { id: 'i5', name: 'Wax Coating', type: 'packaging', quantity: 45, unit: 'kg', price: 12.00, supplier: 'PackPro SAS', supplierId: 's3', minStock: 20, createdAt: '2025-01-15', updatedAt: '2025-03-10', history: [
    { id: 'h7', field: 'quantity', oldValue: '60', newValue: '45', changedBy: 'Marie Dupont', changedAt: '2025-03-10' },
  ] },
  { id: 'i6', name: 'Cheese Wraps', type: 'packaging', quantity: 3, unit: 'rolls', price: 35.00, supplier: 'PackPro SAS', supplierId: 's3', minStock: 10, createdAt: '2025-01-15', updatedAt: '2025-03-19', history: [
    { id: 'h8', field: 'quantity', oldValue: '8', newValue: '3', changedBy: 'Sophie Martin', changedAt: '2025-03-19' },
  ] },
  { id: 'i7', name: 'Labels', type: 'packaging', quantity: 5000, unit: 'units', price: 0.05, supplier: 'PackPro SAS', supplierId: 's3', minStock: 1000, createdAt: '2025-01-15', updatedAt: '2025-03-20', history: [
    { id: 'h9', field: 'quantity', oldValue: '3000', newValue: '5000', changedBy: 'Marie Dupont', changedAt: '2025-03-20' },
  ] },
  { id: 'i8', name: 'Cream', type: 'raw', quantity: 120, unit: 'liters', price: 2.20, supplier: 'Ferme du Vallon', supplierId: 's1', minStock: 50, createdAt: '2025-02-10', updatedAt: '2025-03-21', history: [
    { id: 'h10', field: 'quantity', oldValue: '80', newValue: '120', changedBy: 'Jean Petit', changedAt: '2025-03-21' },
  ] },
];

export const mockRecipes: Recipe[] = [
  {
    id: 'r1', name: 'Camembert Classique', description: 'Traditional soft-ripened cheese with creamy interior.',
    ingredients: [
      { materialId: 'i1', materialName: 'Whole Milk', quantity: 100, unit: 'liters', unitPrice: 0.85 },
      { materialId: 'i2', materialName: 'Rennet', quantity: 0.3, unit: 'liters', unitPrice: 45.00 },
      { materialId: 'i4', materialName: 'Cultures', quantity: 0.2, unit: 'kg', unitPrice: 120.00 },
      { materialId: 'i3', materialName: 'Salt', quantity: 2, unit: 'kg', unitPrice: 0.50 },
    ],
    steps: ['Heat milk to 32°C', 'Add cultures, stir gently', 'Add rennet, let set 45 min', 'Cut curd into 2cm cubes', 'Ladle into molds', 'Salt and age 3 weeks'],
    version: 3, yield: 12, yieldUnit: 'wheels', createdAt: '2024-06-01', updatedAt: '2025-02-14',
    history: [
      { id: 'rh1', field: 'ingredients', oldValue: '3 items', newValue: '4 items', changedBy: 'Marie Dupont', changedAt: '2025-01-10' },
      { id: 'rh2', field: 'steps', oldValue: '5 steps', newValue: '6 steps', changedBy: 'Marie Dupont', changedAt: '2025-02-14' },
    ],
  },
  {
    id: 'r2', name: 'Comté Fermier', description: 'Hard pressed cheese aged for deep nutty flavor.',
    ingredients: [
      { materialId: 'i1', materialName: 'Whole Milk', quantity: 500, unit: 'liters', unitPrice: 0.85 },
      { materialId: 'i2', materialName: 'Rennet', quantity: 1, unit: 'liters', unitPrice: 45.00 },
      { materialId: 'i4', materialName: 'Cultures', quantity: 0.5, unit: 'kg', unitPrice: 120.00 },
      { materialId: 'i3', materialName: 'Salt', quantity: 8, unit: 'kg', unitPrice: 0.50 },
    ],
    steps: ['Heat milk to 33°C', 'Add cultures', 'Add rennet', 'Cut curd finely', 'Cook at 55°C', 'Press into wheels', 'Brine and age 6+ months'],
    version: 2, yield: 40, yieldUnit: 'kg', createdAt: '2024-08-15', updatedAt: '2025-01-20',
    history: [
      { id: 'rh3', field: 'name', oldValue: 'Comté Basic', newValue: 'Comté Fermier', changedBy: 'Jean Petit', changedAt: '2024-12-01' },
    ],
  },
  {
    id: 'r3', name: 'Chèvre Frais', description: 'Fresh goat cheese with herbs.',
    ingredients: [
      { materialId: 'i1', materialName: 'Whole Milk', quantity: 50, unit: 'liters', unitPrice: 0.85 },
      { materialId: 'i2', materialName: 'Rennet', quantity: 0.1, unit: 'liters', unitPrice: 45.00 },
      { materialId: 'i3', materialName: 'Salt', quantity: 1, unit: 'kg', unitPrice: 0.50 },
    ],
    steps: ['Warm milk to 22°C', 'Add cultures and rennet', 'Let set overnight', 'Drain whey', 'Salt and shape'],
    version: 1, yield: 8, yieldUnit: 'kg', createdAt: '2025-01-05', updatedAt: '2025-01-05',
  },
];

export const mockBatches: Batch[] = [
  {
    id: 'b1', recipeId: 'r1', recipeName: 'Camembert Classique', status: 'completed',
    inputMaterials: mockRecipes[0].ingredients, outputQuantity: 12, outputUnit: 'wheels',
    qualityScore: 4.5,
    notes: [{ id: 'n1', text: 'Perfect texture achieved', author: 'Marie Dupont', createdAt: '2025-03-15' }],
    startedAt: '2025-03-10', completedAt: '2025-03-15', operatorId: 'u1', operatorName: 'Marie Dupont',
  },
  {
    id: 'b2', recipeId: 'r2', recipeName: 'Comté Fermier', status: 'in_production',
    inputMaterials: mockRecipes[1].ingredients, outputQuantity: 0, outputUnit: 'kg',
    notes: [{ id: 'n2', text: 'Aging started, cave at 13°C', author: 'Marie Dupont', createdAt: '2025-03-18' }],
    startedAt: '2025-03-18', operatorId: 'u1', operatorName: 'Marie Dupont',
  },
  {
    id: 'b3', recipeId: 'r1', recipeName: 'Camembert Classique', status: 'failed',
    inputMaterials: mockRecipes[0].ingredients, outputQuantity: 0, outputUnit: 'wheels',
    qualityScore: 1.5,
    notes: [{ id: 'n3', text: 'Temperature spike ruined the batch', author: 'Marie Dupont', createdAt: '2025-03-05' }],
    startedAt: '2025-03-01', completedAt: '2025-03-05', operatorId: 'u1', operatorName: 'Marie Dupont',
  },
  {
    id: 'b4', recipeId: 'r3', recipeName: 'Chèvre Frais', status: 'draft',
    inputMaterials: mockRecipes[2].ingredients, outputQuantity: 0, outputUnit: 'kg',
    notes: [], startedAt: '2025-03-22', operatorId: 'u1', operatorName: 'Marie Dupont',
  },
];

export const mockQualityControls: QualityControl[] = [
  { id: 'qc1', batchId: 'b1', taste: 5, texture: 4, smell: 5, overallScore: 4.5, approved: true, evaluatedBy: 'Marie Dupont', evaluatedAt: '2025-03-15', notes: 'Excellent batch.' },
  { id: 'qc2', batchId: 'b3', taste: 1, texture: 2, smell: 2, overallScore: 1.5, approved: false, evaluatedBy: 'Marie Dupont', evaluatedAt: '2025-03-05', notes: 'Off flavors, rejected.' },
];

export const mockCustomers: Customer[] = [
  { id: 'c1', name: 'Le Bon Marché', email: 'orders@bonmarche.fr', phone: '+33 1 44 39 80 00', address: '24 Rue de Sèvres, Paris' },
  { id: 'c2', name: 'Fromagerie Laurent', email: 'laurent@fromages.fr', phone: '+33 4 78 42 01 22', address: '12 Rue Mercière, Lyon' },
  { id: 'c3', name: 'Restaurant Étoile', email: 'chef@etoile.fr', phone: '+33 1 58 36 12 50', address: '8 Place Vendôme, Paris' },
];

export const mockOrders: Order[] = [
  {
    id: 'o1', customerId: 'c1', customerName: 'Le Bon Marché',
    items: [{ productName: 'Camembert Classique', quantity: 24, unitPrice: 8.5, total: 204 }],
    totalAmount: 204, amountPaid: 204, amountReturned: 0, status: 'paid',
    payments: [{ id: 'p1', amount: 204, date: '2025-03-17', method: 'Bank Transfer' }],
    returns: [],
    createdAt: '2025-03-16', paidAt: '2025-03-17',
  },
  {
    id: 'o2', customerId: 'c2', customerName: 'Fromagerie Laurent',
    items: [
      { productName: 'Camembert Classique', quantity: 12, unitPrice: 8.5, total: 102 },
      { productName: 'Chèvre Frais', quantity: 5, unitPrice: 12, total: 60 },
    ],
    totalAmount: 162, amountPaid: 80, amountReturned: 0, status: 'partial',
    payments: [{ id: 'p2', amount: 80, date: '2025-03-20', method: 'Cash' }],
    returns: [],
    createdAt: '2025-03-20',
  },
  {
    id: 'o3', customerId: 'c3', customerName: 'Restaurant Étoile',
    items: [{ productName: 'Comté Fermier', quantity: 10, unitPrice: 22, total: 220 }],
    totalAmount: 220, amountPaid: 220, amountReturned: 44, status: 'paid',
    payments: [{ id: 'p3', amount: 220, date: '2025-03-22', method: 'Card' }],
    returns: [{ id: 'ret1', productName: 'Comté Fermier', quantity: 2, reason: 'Damaged during transport', refundAmount: 44, date: '2025-03-23' }],
    createdAt: '2025-03-21', paidAt: '2025-03-22',
  },
];

export const mockNotifications: Notification[] = [
  { id: 'nt1', title: 'Low Stock Alert', message: 'Cheese Wraps below minimum (3/10 rolls)', type: 'warning', read: false, createdAt: '2025-03-22' },
  { id: 'nt2', title: 'Batch Failed', message: 'Batch #b3 (Camembert) failed quality control', type: 'error', read: false, createdAt: '2025-03-05' },
  { id: 'nt3', title: 'Order Received', message: 'New order from Restaurant Étoile — DH220', type: 'info', read: true, createdAt: '2025-03-21' },
  { id: 'nt4', title: 'Batch Completed', message: 'Batch #b1 (Camembert) completed successfully', type: 'success', read: true, createdAt: '2025-03-15' },
];

export const salesChartData = [
  { month: 'Oct', sales: 1800 }, { month: 'Nov', sales: 2400 }, { month: 'Dec', sales: 3100 },
  { month: 'Jan', sales: 2800 }, { month: 'Feb', sales: 3400 }, { month: 'Mar', sales: 586 },
];

export const batchChartData = [
  { month: 'Oct', completed: 8, failed: 1 }, { month: 'Nov', completed: 10, failed: 2 },
  { month: 'Dec', completed: 12, failed: 0 }, { month: 'Jan', completed: 9, failed: 1 },
  { month: 'Feb', completed: 11, failed: 1 }, { month: 'Mar', completed: 3, failed: 1 },
];
