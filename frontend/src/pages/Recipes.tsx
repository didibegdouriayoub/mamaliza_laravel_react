import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, ChevronRight, Plus, Edit, Trash2, History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TableSkeleton, EmptyState } from '@/components/DataStates';
import { recipeService } from '@/services/recipeService';
import { inventoryService } from '@/services/inventoryService';
import { Recipe, RecipeIngredient, InventoryItem } from '@/models/types';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const emptyIng: RecipeIngredient = { materialId: '', materialName: '', quantity: 0, unit: '', unitPrice: 0 };

export default function Recipes() {
  const { user, hasPermission } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [historyRecipe, setHistoryRecipe] = useState<Recipe | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([{ ...emptyIng }]);
  const [steps, setSteps] = useState<string[]>(['']);
  const [targetWeight, setTargetWeight] = useState('');
  const [pieceWeight, setPieceWeight] = useState('');
  const [recipeStatus, setRecipeStatus] = useState<'semi_final' | 'final'>('semi_final');
  const [recipePackages, setRecipePackages] = useState<any[]>([]);
  const { toast } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const [recipeRaw, invData] = await Promise.all([
        recipeService.getAll(),
        inventoryService.getAll()
      ]);
      // Ensure arrays are never null/undefined
      const recipeData = (recipeRaw || []).map((r: any) => ({
        ...r,
        targetWeight: Number(r.target_weight ?? r.targetWeight) || 0,
        pieceWeight: r.piece_weight ?? r.pieceWeight ?? '',
        recipeStatus: r.recipe_status ?? r.recipeStatus ?? 'semi_final',
        packages: r.packages || [],
        ingredients: (r.ingredients || []).map((i: any) => ({
          ...i,
          quantity: Number(i.quantity) || 0,
          unitPrice: Number(i.unitPrice ?? i.unit_price) || 0,
        })),
        steps: r.steps || [],
        history: (r.history || []).map((h: any) => ({
          id: String(h.id),
          field: h.field,
          oldValue: String(h.oldValue ?? h.old_value ?? ''),
          newValue: String(h.newValue ?? h.new_value ?? ''),
          changedBy: h.user?.name || 'System',
          changedAt: h.changedAt || h.changed_at || '',
        })),
        version: r.version || 1,
      }));
      setRecipes(recipeData);
      setInventory((invData || []).map((m: any) => ({ ...m, price: Number(m.price) || 0 })));
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const openCreate = () => {
    setEditingRecipe(null);
    setName(''); setDescription(''); setIngredients([{ ...emptyIng }]); setSteps(['']);
    setTargetWeight(''); setPieceWeight(''); setRecipeStatus('semi_final'); setRecipePackages([]);
    setFormOpen(true);
  };

  const openEdit = (r: Recipe) => {
    setEditingRecipe(r);
    setName(r.name); setDescription(r.description);
    setIngredients(r.ingredients.map(i => ({ ...i })));
    setSteps([...r.steps]); 
    setTargetWeight(r.targetWeight ? String(r.targetWeight) : '');
    setPieceWeight(r.pieceWeight); 
    setRecipeStatus(r.recipeStatus);
    setRecipePackages(r.packages || []);
    setFormOpen(true);
    setSelected(null);
  };

  const handleSave = async () => {
    if (!name) return;
    const validIngs = ingredients.filter(i => i.materialId);
    const validSteps = steps.filter(s => s.trim());

    try {
      const targetWeightNum = Number(targetWeight) || 0;
      if (editingRecipe) {
        await recipeService.update(editingRecipe.id, {
          name, description, ingredients: validIngs, steps: validSteps,
          targetWeight: targetWeightNum, pieceWeight, recipeStatus, packages: recipePackages,
        });
        toast({ title: 'Recipe updated' });
      } else {
        await recipeService.create({
          name, description, ingredients: validIngs, steps: validSteps,
          targetWeight: targetWeightNum, pieceWeight, recipeStatus, packages: recipePackages,
        });
        toast({ title: 'Recipe created' });
      }
      setFormOpen(false);
      loadData();
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message || 'An error occurred.', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    await recipeService.delete(id);
    toast({ title: 'Recipe deleted', variant: 'destructive' });
    setSelected(null);
    loadData();
  };

  const setIng = (idx: number, updates: Partial<RecipeIngredient>) => {
    setIngredients(prev => prev.map((ing, i) => i === idx ? { ...ing, ...updates } : ing));
  };

  const handleMaterialSelect = (idx: number, materialId: string) => {
    const mat = inventory.find(m => String(m.id) === String(materialId));
    if (mat) setIng(idx, { materialId: String(mat.id), materialName: mat.name, unit: mat.unit, unitPrice: mat.price });
  };

  const totalCost = ingredients.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0);
  const packagingCost = recipePackages.reduce((sum, pkg) => {
    const item = inventory.find(m => String(m.id) === String(pkg.id));
    return sum + (pkg.quantity * (item?.price || 0));
  }, 0);

  if (loading) return <div className="space-y-6"><TableSkeleton /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2"><BookOpen className="h-6 w-6" /> Recipes</h1>
          <p className="text-sm text-muted-foreground">Manage your cheese recipes and formulations</p>
        </div>
        {hasPermission('recipes.write') && (
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> New Recipe</Button>
        )}
      </div>

      {recipes.length === 0 ? <EmptyState title="No recipes yet" description="Create your first recipe to get started." icon="📖" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recipes.map((recipe, idx) => (
            <motion.div key={recipe.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.08 }}>
              <Card className="shadow-card hover:shadow-elevated transition-all cursor-pointer group" onClick={() => setSelected(recipe)}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg font-display">{recipe.name}</CardTitle>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant="secondary" className="text-[10px] px-1.5 h-4">v{recipe.version}</Badge>
                      <Badge variant={recipe.recipeStatus === 'final' ? 'default' : 'outline'} className="text-[10px] px-1.5 h-4 capitalize">
                        {recipe.recipeStatus.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{recipe.description}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{recipe.ingredients.length} ing. • {recipe.steps.length} steps</span>
                    <span className="font-medium">Target: {recipe.targetWeight} ({recipe.pieceWeight})</span>
                  </div>
                  <p className="text-xs font-medium text-primary mt-1">
                    Cost: €{recipe.ingredients.reduce((s, i) => s + i.quantity * i.unitPrice, 0).toFixed(2)}
                  </p>
                  <div className="flex items-center gap-1 text-primary text-xs mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    View details <ChevronRight className="h-3 w-3" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-xl flex items-center gap-2">
                  {selected.name} <Badge variant="secondary" className="ml-2">v{selected.version}</Badge>
                </DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">{selected.description}</p>
              <div className="space-y-4 mt-2">
                <div>
                  <h4 className="font-display font-semibold text-sm mb-2">Ingredients</h4>
                  <div className="space-y-1.5">
                    {selected.ingredients.map((ing, i) => (
                      <div key={i} className="flex justify-between text-sm py-1 border-b last:border-0">
                        <span>{ing.materialName}</span>
                        <span className="text-muted-foreground">{ing.quantity} {ing.unit} × €{ing.unitPrice.toFixed(2)} = <span className="text-foreground font-medium">€{(ing.quantity * ing.unitPrice).toFixed(2)}</span></span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-semibold pt-1">
                      <span>Total Cost</span>
                      <span>€{selected.ingredients.reduce((s, i) => s + i.quantity * i.unitPrice, 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-display font-semibold text-sm mb-2">Steps</h4>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                    {selected.steps.map((step, i) => <li key={i}>{step}</li>)}
                  </ol>
                </div>
                <div className="text-xs text-muted-foreground pt-2 border-t flex justify-between items-center">
                  <div>
                    Target: <span className="font-medium text-foreground">{selected.targetWeight}</span> •
                    Piece Weight: <span className="font-medium text-foreground">{selected.pieceWeight}</span>
                  </div>
                  <Badge variant={selected.recipeStatus === 'final' ? 'default' : 'outline'} className="capitalize">
                    {selected.recipeStatus.replace('_', ' ')}
                  </Badge>
                </div>
                {selected.packages && selected.packages.length > 0 && (
                  <div className="pt-2 border-t text-xs">
                    <h5 className="font-semibold mb-1">Standard Packaging:</h5>
                    <div className="flex flex-wrap gap-2">
                       {selected.packages.map((pkg: any, i: number) => (
                         <Badge key={i} variant="outline" className="bg-muted/30">{pkg.name} ({pkg.quantity})</Badge>
                       ))}
                    </div>
                  </div>
                )}
                <div className="text-[10px] text-muted-foreground pt-1">
                  Updated: {selected.updatedAt}
                </div>
              </div>
              <DialogFooter className="gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => { setHistoryRecipe(selected); setSelected(null); }}>
                  <History className="h-3 w-3 mr-1" /> History
                </Button>
                {hasPermission('recipes.write') && (
                  <>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm"><Trash2 className="h-3 w-3 mr-1" /> Delete</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Delete {selected.name}?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(selected.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <Button size="sm" onClick={() => openEdit(selected)}><Edit className="h-3 w-3 mr-1" /> Edit</Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Recipe History Dialog */}
      <Dialog open={!!historyRecipe} onOpenChange={() => setHistoryRecipe(null)}>
        <DialogContent>
          {historyRecipe && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display flex items-center gap-2"><History className="h-5 w-5" /> Recipe History — {historyRecipe.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {(historyRecipe.history || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No changes recorded yet. Changes are tracked when you edit a recipe.</p>
                ) : (
                  [...(historyRecipe.history || [])].sort((a, b) => b.changedAt.localeCompare(a.changedAt)).map(h => (
                    <div key={h.id} className="text-sm py-2 border-b last:border-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium capitalize">{h.field}</span>
                        <span className="text-xs text-muted-foreground">{h.changedAt}</span>
                      </div>
                      <p className="text-muted-foreground">
                        <span className="line-through">{h.oldValue}</span> → <span className="text-foreground font-medium">{h.newValue}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">by {h.changedBy}</p>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{editingRecipe ? 'Edit Recipe' : 'New Recipe'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Camembert Classique" />
              </div>
              <div className="space-y-1.5">
                <Label>Recipe Status</Label>
                <Select value={recipeStatus} onValueChange={(v: any) => setRecipeStatus(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semi_final">Semi-Final</SelectItem>
                    <SelectItem value="final">Final</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Target Weight (Batch Total)</Label><Input type="number" value={targetWeight} onChange={e => setTargetWeight(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Piece Weight (Unit)</Label><Input value={pieceWeight} onChange={e => setPieceWeight(e.target.value)} placeholder="e.g. 500g" /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Ingredients</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => setIngredients(p => [...p, { ...emptyIng }])}><Plus className="h-3 w-3 mr-1" /> Add</Button>
              </div>
              {ingredients.map((ing, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_80px_80px_40px] gap-2 items-end">
                  <Select value={ing.materialId} onValueChange={v => handleMaterialSelect(idx, v)}>
                    <SelectTrigger><SelectValue placeholder="Material" /></SelectTrigger>
                    <SelectContent>
                      {inventory.filter(m => m.type === 'raw').map(m => (
                        <SelectItem key={m.id} value={String(m.id)}>{m.name} (€{m.price}/{m.unit})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input type="number" placeholder="Qty" value={ing.quantity || ''} onChange={e => setIng(idx, { quantity: Number(e.target.value) })} />
                  <span className="text-xs text-muted-foreground py-2">€{(ing.quantity * ing.unitPrice).toFixed(2)}</span>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setIngredients(p => p.filter((_, i) => i !== idx))}><Trash2 className="h-3 w-3" /></Button>
                </div>
              ))}
            <p className="text-sm font-medium text-right">Total: €{totalCost.toFixed(2)}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Standard Packaging</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => setRecipePackages(p => [...p, { id: '', name: '', quantity: 1 }])}><Plus className="h-3 w-3 mr-1" /> Add</Button>
              </div>
              {recipePackages.map((pkg, idx) => {
                const pkgItem = inventory.find(m => String(m.id) === String(pkg.id));
                const rowCost = pkg.quantity * (pkgItem?.price || 0);
                return (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_100px_80px_40px] gap-2 items-end">
                    <Select value={pkg.id} onValueChange={v => {
                      const item = inventory.find(m => String(m.id) === String(v));
                      if (item) setRecipePackages(p => p.map((x, i) => i === idx ? { id: String(item.id), name: item.name, quantity: x.quantity } : x));
                    }}>
                      <SelectTrigger><SelectValue placeholder="Packaging Item" /></SelectTrigger>
                      <SelectContent>
                        {inventory.filter(m => m.type === 'packaging').map(m => (
                          <SelectItem key={m.id} value={String(m.id)}>{m.name} (€{m.price}/{m.unit})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input type="number" placeholder="Qty" value={pkg.quantity || ''} onChange={e => setRecipePackages(p => p.map((x, i) => i === idx ? { ...x, quantity: Number(e.target.value) } : x))} />
                    <span className="text-xs text-muted-foreground py-2">€{rowCost.toFixed(2)}</span>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setRecipePackages(p => p.filter((_, i) => i !== idx))}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                );
              })}
              {recipePackages.length > 0 && (
                <p className="text-sm font-medium text-right">Packaging: €{packagingCost.toFixed(2)}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Steps</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => setSteps(p => [...p, ''])}><Plus className="h-3 w-3 mr-1" /> Add</Button>
              </div>
              {steps.map((step, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <span className="text-xs text-muted-foreground w-6">{idx + 1}.</span>
                  <Input value={step} onChange={e => setSteps(p => p.map((s, i) => i === idx ? e.target.value : s))} placeholder="Step description" />
                  <Button type="button" variant="ghost" size="icon" onClick={() => setSteps(p => p.filter((_, i) => i !== idx))}><Trash2 className="h-3 w-3" /></Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingRecipe ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
