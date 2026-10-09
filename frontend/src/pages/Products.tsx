import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, Package, Box } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TableSkeleton, EmptyState } from '@/components/DataStates';
import { finishedProductService, FinishedProduct, FinishedProductInput, FinishedProductMaterial, FinishedProductComponent } from '@/services/finishedProductService';
import { inventoryService } from '@/services/inventoryService';
import { recipeLabel } from '@/lib/recipeLabel';
import { recipeService } from '@/services/recipeService';
import { InventoryItem, Recipe } from '@/models/types';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const PACKAGING_TYPES = ['packaging', 'Box', 'Case', 'Vacbag', 'Label', 'Ticket', 'Wrap', 'Wax'];

const emptyInput = (): FinishedProductInput => ({ recipe_id: '', kg_per_piece: 0 });
const emptyMaterial = (): FinishedProductMaterial => ({ inventory_item_id: '', qty_per_piece: 1 });
const emptyComponent = (): FinishedProductComponent => ({ component_id: '', qty_per_box: 1 });

export default function Products() {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const canWrite = hasPermission('products.write');

  const [products, setProducts] = useState<FinishedProduct[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FinishedProduct | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState<'piece' | 'box'>('piece');
  const [unitPrice, setUnitPrice] = useState('0');
  const [notes, setNotes] = useState('');
  const [inputs, setInputs] = useState<FinishedProductInput[]>([emptyInput()]);
  const [materials, setMaterials] = useState<FinishedProductMaterial[]>([emptyMaterial()]);
  const [components, setComponents] = useState<FinishedProductComponent[]>([emptyComponent()]);

  const packagingItems = inventory.filter(i => PACKAGING_TYPES.includes(i.type));
  const pieceProducts = products.filter(p => p.type === 'piece');

  const load = async () => {
    setLoading(true);
    try {
      const [prods, recs, inv] = await Promise.all([
        finishedProductService.getAll().catch(() => []),
        recipeService.getAll().catch(() => []),
        inventoryService.getAll().catch(() => []),
      ]);
      setProducts(prods || []);
      setRecipes((recs || []).map((r: any) => ({ ...r, id: String(r.id) })));
      setInventory(inv || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setName(''); setType('piece'); setUnitPrice('0'); setNotes('');
    setInputs([emptyInput()]); setMaterials([emptyMaterial()]); setComponents([emptyComponent()]);
    setFormOpen(true);
  };

  const openEdit = (p: FinishedProduct) => {
    setEditing(p);
    setName(p.name); setType(p.type); setUnitPrice(String(p.unit_price)); setNotes(p.notes || '');
    setInputs(p.inputs.length ? p.inputs.map(i => ({ recipe_id: i.recipe_id, kg_per_piece: i.kg_per_piece })) : [emptyInput()]);
    setMaterials(p.materials.length ? p.materials.map(m => ({ inventory_item_id: m.inventory_item_id, qty_per_piece: m.qty_per_piece })) : [emptyMaterial()]);
    setComponents(p.components.length ? p.components.map(c => ({ component_id: c.component_id, qty_per_box: c.qty_per_box })) : [emptyComponent()]);
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) { toast({ title: 'Name is required', variant: 'destructive' }); return; }
    const payload = {
      name: name.trim(),
      type,
      unit_price: parseFloat(unitPrice) || 0,
      notes: notes.trim() || null,
      inputs: type === 'piece' ? inputs.filter(i => i.recipe_id) : [],
      materials: materials.filter(m => m.inventory_item_id),
      components: type === 'box' ? components.filter(c => c.component_id) : [],
    };
    try {
      if (editing) {
        await finishedProductService.update(editing.id, payload as any);
        toast({ title: 'Product updated' });
      } else {
        await finishedProductService.create(payload as any);
        toast({ title: 'Product created' });
      }
      setFormOpen(false);
      load();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await finishedProductService.delete(id);
      toast({ title: 'Product deleted' });
      load();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-display font-bold">Finished Products</h1>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />New Product</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? <TableSkeleton cols={5} rows={4} /> : products.length === 0 ? (
            <EmptyState title="No products yet" description="Define your finished products to start tracking stock and invoicing." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Unit Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Inputs / Components</TableHead>
                  <TableHead>Packaging</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      <Badge variant={p.type === 'box' ? 'default' : 'secondary'}>
                        {p.type === 'box' ? <><Box className="h-3 w-3 mr-1" />Box</> : <><Package className="h-3 w-3 mr-1" />Piece</>}
                      </Badge>
                    </TableCell>
                    <TableCell>{p.unit_price.toFixed(2)} DH</TableCell>
                    <TableCell>
                      <span className={`font-medium ${(p.stock?.quantity ?? 0) === 0 ? 'text-destructive' : 'text-green-600'}`}>
                        {p.stock?.quantity ?? 0} pcs
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.type === 'piece'
                        ? p.inputs.map(i => `${i.recipe?.name ?? '—'} (${i.kg_per_piece}kg/pc)`).join(', ') || '—'
                        : p.components.map(c => `${c.component?.name ?? '—'} ×${c.qty_per_box}`).join(', ') || '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.materials.map(m => `${m.inventory_item?.name ?? '—'} ×${m.qty_per_piece}`).join(', ') || '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Edit className="h-4 w-4" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete "{p.name}"?</AlertDialogTitle>
                              <AlertDialogDescription>This will remove the product and its stock record.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(p.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Product' : 'New Finished Product'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Fromage Frais 1kg" />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={type} onValueChange={v => setType(v as 'piece' | 'box')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="piece">Piece (individual unit)</SelectItem>
                    <SelectItem value="box">Box (contains pieces)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Unit Price (DH)</Label>
              <Input type="number" min="0" step="0.01" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} placeholder="0.00" />
            </div>

            {/* Piece: recipe inputs */}
            {type === 'piece' && (
              <div className="space-y-2">
                <Label>Pâte Source (recipe)</Label>
                {inputs.map((inp, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Select value={String(inp.recipe_id)} onValueChange={v => setInputs(prev => prev.map((x, j) => j === i ? { ...x, recipe_id: v } : x))}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Select recipe" /></SelectTrigger>
                      <SelectContent>
                        {recipes.map(r => <SelectItem key={r.id} value={String(r.id)}>{recipeLabel(r)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1 shrink-0">
                      <Input type="number" min="0" step="0.001" className="w-24" placeholder="kg" value={inp.kg_per_piece || ''}
                        onChange={e => setInputs(prev => prev.map((x, j) => j === i ? { ...x, kg_per_piece: parseFloat(e.target.value) || 0 } : x))} />
                      <span className="text-xs text-muted-foreground">kg/pc</span>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => setInputs(prev => prev.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setInputs(prev => [...prev, emptyInput()])}>+ Add recipe</Button>
              </div>
            )}

            {/* Box: piece components */}
            {type === 'box' && (
              <div className="space-y-2">
                <Label>Contents (pieces per box)</Label>
                {components.map((comp, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Select value={String(comp.component_id)} onValueChange={v => setComponents(prev => prev.map((x, j) => j === i ? { ...x, component_id: v } : x))}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Select piece product" /></SelectTrigger>
                      <SelectContent>
                        {pieceProducts.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input type="number" min="1" className="w-24" placeholder="qty" value={comp.qty_per_box} onChange={e => setComponents(prev => prev.map((x, j) => j === i ? { ...x, qty_per_box: parseFloat(e.target.value) || 1 } : x))} />
                    <Button size="icon" variant="ghost" onClick={() => setComponents(prev => prev.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setComponents(prev => [...prev, emptyComponent()])}>+ Add component</Button>
              </div>
            )}

            {/* Packaging materials */}
            <div className="space-y-2">
              <Label>Packaging per {type === 'box' ? 'box' : 'piece'}</Label>
              {materials.map((mat, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Select value={String(mat.inventory_item_id)} onValueChange={v => setMaterials(prev => prev.map((x, j) => j === i ? { ...x, inventory_item_id: v } : x))}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Select packaging item" /></SelectTrigger>
                    <SelectContent>
                      {packagingItems.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.name} ({item.type})</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input type="number" min="0" step="0.001" className="w-24" placeholder="qty" value={mat.qty_per_piece} onChange={e => setMaterials(prev => prev.map((x, j) => j === i ? { ...x, qty_per_piece: parseFloat(e.target.value) || 0 } : x))} />
                  <Button size="icon" variant="ghost" onClick={() => setMaterials(prev => prev.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setMaterials(prev => [...prev, emptyMaterial()])}>+ Add packaging</Button>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editing ? 'Save Changes' : 'Create Product'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
