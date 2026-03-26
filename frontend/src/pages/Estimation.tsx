import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calculator, Plus, Trash2, Printer, Factory } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { recipeService } from '@/services/recipeService';
import { inventoryService } from '@/services/inventoryService';
import { batchService } from '@/services/batchService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Recipe, InventoryItem, BatchStatus } from '@/models/types';

interface EstimationLine {
  recipeId: string;
  batchCount: number;
}

export default function Estimation() {
  const [lines, setLines] = useState<EstimationLine[]>([{ recipeId: '', batchCount: 1 }]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [pkgRatios, setPkgRatios] = useState<Record<string, number>>({});
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const loadData = async () => {
      try {
        const [recipeData, invData] = await Promise.all([
          recipeService.getAll(),
          inventoryService.getAll()
        ]);
        const rData = (recipeData || []).map((r: any) => ({
          ...r,
          yield: Number(r.yield) || 0,
          ingredients: (r.ingredients || []).map((i: any) => ({ ...i, quantity: Number(i.quantity) || 0, unitPrice: Number(i.unitPrice ?? i.unit_price) || 0 })),
        }));
        setRecipes(rData);
        
        const initialRatios: Record<string, number> = {};
        (invData || []).filter(i => i.type === 'packaging').forEach(p => {
          initialRatios[p.id] = p.name.toLowerCase().includes('label') ? 1 : 0.1;
        });
        setPkgRatios(initialRatios);
        const iData = (invData || []).map((i: any) => ({ ...i, quantity: Number(i.quantity) || 0, price: Number(i.price) || 0 }));
        setInventory(iData);
      } catch(e) { console.error(e); }
    };
    loadData();
  }, []);

  const handleCreateBatches = async () => {
    const validLines = lines.filter(l => l.recipeId && l.batchCount > 0);
    if (validLines.length === 0) return;
    
    setIsCreating(true);
    let createdCount = 0;
    
    try {
      for (const line of validLines) {
        const recipe = recipes.find(r => String(r.id) === String(line.recipeId));
        if (!recipe) continue;
        
        for (let i = 0; i < line.batchCount; i++) {
          await batchService.create({
            recipeId: recipe.id,
            recipeName: recipe.name,
            status: 'draft' as BatchStatus,
            inputMaterials: recipe.ingredients,
            outputQuantity: 0,
            outputUnit: recipe.yieldUnit,
            operatorId: user.id as string,
            operatorName: user.name,
            startedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
          });
          createdCount++;
        }
      }
      toast({ title: 'Success', description: `Created ${createdCount} draft batches successfully.` });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Error creating batches', description: e.message, variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  const addLine = () => setLines(prev => [...prev, { recipeId: '', batchCount: 1 }]);
  const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx));
  const updateLine = (idx: number, updates: Partial<EstimationLine>) =>
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, ...updates } : l));

  // Aggregate ingredients needed
  const aggregated = new Map<string, { name: string; quantity: number; unit: string; unitPrice: number; type: string }>();

  lines.forEach(line => {
    const recipe = recipes.find(r => String(r.id) === String(line.recipeId));
    if (!recipe) return;
    recipe.ingredients.forEach(ing => {
      const existing = aggregated.get(ing.materialId);
      const needed = ing.quantity * line.batchCount;
      if (existing) {
        existing.quantity += needed;
      } else {
        const invItem = inventory.find(i => String(i.id) === String(ing.materialId));
        aggregated.set(ing.materialId, {
          name: ing.materialName,
          quantity: needed,
          unit: ing.unit,
          unitPrice: ing.unitPrice,
          type: invItem?.type || 'raw',
        });
      }
    });
  });

  // Also estimate packaging needs based on dynamic ratios per yield unit
  const totalYield = lines.reduce((sum, line) => {
    const recipe = recipes.find(r => String(r.id) === String(line.recipeId));
    return sum + (recipe ? recipe.yield * line.batchCount : 0);
  }, 0);

  const packagingNeeds = inventory.filter(i => i.type === 'packaging').map(pkg => ({
    ...pkg,
    estimated: Math.ceil(totalYield * (pkgRatios[pkg.id] || 0)),
  }));

  const ingredientList = Array.from(aggregated.values());
  const totalIngredientCost = ingredientList.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const totalPackagingCost = packagingNeeds.reduce((sum, p) => sum + p.estimated * p.price, 0);
  const totalCost = totalIngredientCost + totalPackagingCost;

  const hasEstimation = lines.some(l => l.recipeId);

  // Stock availability check
  const stockStatus = ingredientList.map(ing => {
    const invItem = inventory.find(i => i.name === ing.name);
    const available = invItem?.quantity || 0;
    return { ...ing, available, sufficient: available >= ing.quantity };
  });

  const handlePrint = () => window.print();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2"><Calculator className="h-6 w-6" /> Production Estimation</h1>
          <p className="text-sm text-muted-foreground">Estimate ingredients, packaging, and costs for planned batches</p>
        </div>
        {hasEstimation && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handlePrint}><Printer className="h-4 w-4 mr-1" /> Print</Button>
            <Button onClick={handleCreateBatches} disabled={isCreating}>
              <Factory className="h-4 w-4 mr-1" /> {isCreating ? 'Creating...' : 'Create Batches'}
            </Button>
          </div>
        )}
      </div>

      {/* Recipe selection */}
      <Card className="shadow-card print:hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-display">Select Recipes & Batch Counts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {lines.map((line, idx) => (
            <div key={idx} className="flex flex-col sm:flex-row gap-2 items-start sm:items-end">
              <div className="flex-1 space-y-1.5 w-full">
                <Label className="text-xs">Recipe</Label>
                <Select value={line.recipeId} onValueChange={v => updateLine(idx, { recipeId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select recipe" /></SelectTrigger>
                  <SelectContent>
                    {recipes.map(r => <SelectItem key={r.id} value={String(r.id)}>{r.name} (yields {r.yield} {r.yieldUnit})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-32 space-y-1.5">
                <Label className="text-xs">Batches</Label>
                <Input type="number" min={1} value={line.batchCount} onChange={e => updateLine(idx, { batchCount: Math.max(1, Number(e.target.value)) })} />
              </div>
              {lines.length > 1 && (
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => removeLine(idx)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addLine}><Plus className="h-3 w-3 mr-1" /> Add Recipe</Button>
        </CardContent>
      </Card>

      {hasEstimation && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="shadow-card">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Ingredient Cost</p>
                <p className="text-2xl font-display font-bold text-primary">€{totalIngredientCost.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card className="shadow-card">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Packaging Cost</p>
                <p className="text-2xl font-display font-bold text-primary">€{totalPackagingCost.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card className="shadow-card">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Total Investment</p>
                <p className="text-2xl font-display font-bold text-primary">€{totalCost.toFixed(2)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Ingredients table */}
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display">Required Ingredients</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-right">Needed</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">In Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockStatus.map((ing, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{ing.name}</TableCell>
                      <TableCell className="text-right">{ing.quantity.toFixed(1)}</TableCell>
                      <TableCell>{ing.unit}</TableCell>
                      <TableCell className="text-right">{ing.available}</TableCell>
                      <TableCell>
                        <Badge className={ing.sufficient ? 'bg-success text-success-foreground' : 'bg-destructive text-destructive-foreground'}>
                          {ing.sufficient ? 'OK' : `Need ${(ing.quantity - ing.available).toFixed(1)} more`}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">€{(ing.quantity * ing.unitPrice).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Packaging table */}
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display">Estimated Packaging</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead className="w-24">Ratio/Unit</TableHead>
                    <TableHead className="text-right">Estimated</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">In Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packagingNeeds.map((pkg, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{pkg.name}</TableCell>
                      <TableCell>
                        <Input 
                          type="number" 
                          step="0.01" 
                          min="0"
                          className="h-8 text-xs py-1"
                          value={pkgRatios[pkg.id] ?? ''} 
                          onChange={e => setPkgRatios(p => ({ ...p, [pkg.id]: Number(e.target.value) || 0 }))} 
                        />
                      </TableCell>
                      <TableCell className="text-right">{pkg.estimated}</TableCell>
                      <TableCell>{pkg.unit}</TableCell>
                      <TableCell className="text-right">{pkg.quantity}</TableCell>
                      <TableCell>
                        <Badge className={pkg.quantity >= pkg.estimated ? 'bg-success text-success-foreground' : 'bg-destructive text-destructive-foreground'}>
                          {pkg.quantity >= pkg.estimated ? 'OK' : 'Low'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">€{(pkg.estimated * pkg.price).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Yield summary */}
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display">Production Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipe</TableHead>
                    <TableHead className="text-right">Batches</TableHead>
                    <TableHead className="text-right">Yield/Batch</TableHead>
                    <TableHead className="text-right">Total Yield</TableHead>
                    <TableHead className="text-right">Cost/Batch</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.filter(l => l.recipeId).map((line, i) => {
                    const recipe = recipes.find(r => String(r.id) === String(line.recipeId))!;
                    const batchCost = recipe.ingredients.reduce((s, ing) => s + ing.quantity * ing.unitPrice, 0);
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{recipe.name}</TableCell>
                        <TableCell className="text-right">{line.batchCount}</TableCell>
                        <TableCell className="text-right">{recipe.yield} {recipe.yieldUnit}</TableCell>
                        <TableCell className="text-right font-semibold">{recipe.yield * line.batchCount} {recipe.yieldUnit}</TableCell>
                        <TableCell className="text-right">€{batchCost.toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
