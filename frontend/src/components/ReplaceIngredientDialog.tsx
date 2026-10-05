import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StockBadge } from '@/components/StatusBadge';
import { TableSkeleton } from '@/components/DataStates';
import { inventoryService } from '@/services/inventoryService';
import { recipeService } from '@/services/recipeService';
import { useToast } from '@/hooks/use-toast';

interface UsageItem { id: number; name: string; lot?: string; code?: string; unit: string; quantity: number; minStock: number }
interface UsageRecipe { recipeId: number; recipeName: string; description?: string; quantity: number; unit: string }

const itemLabel = (i: { name: string; lot?: string }) => `${i.name.trim()}${i.lot ? ` — lot ${i.lot}` : ''}`;

/** Admin tool: swap an inventory item (e.g. a lot running low) for another with the same code + unit across recipes. */
export function ReplaceIngredientDialog({ itemId, onClose, onDone }: { itemId: string | null; onClose: () => void; onDone?: () => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [item, setItem] = useState<UsageItem | null>(null);
  const [recipes, setRecipes] = useState<UsageRecipe[]>([]);
  const [candidates, setCandidates] = useState<UsageItem[]>([]);
  const [targetId, setTargetId] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!itemId) return;
    setLoading(true);
    setTargetId('');
    inventoryService.getRecipeUsage(itemId)
      .then((d: any) => {
        setItem(d.item);
        setRecipes(d.recipes || []);
        setCandidates((d.candidates || []).map((c: any) => ({ ...c, quantity: Number(c.quantity) || 0, minStock: Number(c.minStock) || 0 })));
        setSelected(new Set((d.recipes || []).map((r: UsageRecipe) => r.recipeId)));
        // Pre-select the best-stocked replacement (backend sorts by quantity)
        const best = (d.candidates || []).find((c: any) => Number(c.quantity) > 0);
        if (best) setTargetId(String(best.id));
      })
      .catch((e: any) => toast({ title: 'Could not load recipes', description: e.message, variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [itemId]);

  const target = candidates.find(c => String(c.id) === targetId);
  const toggle = (id: number) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const handleReplace = async () => {
    if (!item || !target || selected.size === 0) return;
    setSaving(true);
    try {
      const res: any = await recipeService.replaceIngredient(item.id, target.id, [...selected]);
      toast({ title: `Replaced in ${res.count} recipe${res.count !== 1 ? 's' : ''}`, description: `${itemLabel(item)} → ${itemLabel(target)}` });
      onDone?.();
      onClose();
    } catch (e: any) {
      toast({ title: 'Replace failed', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <Dialog open={!!itemId} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Replace in recipes</DialogTitle>
          <DialogDescription>
            Swap this ingredient for another with the same code{item?.code ? ` (${item.code})` : ''} and unit. Quantities stay the same; past batches are not changed.
          </DialogDescription>
        </DialogHeader>

        {loading || !item ? <TableSkeleton rows={3} cols={2} /> : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-end">
              <div className="space-y-1.5">
                <Label>Current ingredient</Label>
                <div className="rounded-md border px-3 py-2 text-sm">
                  <div className="font-medium">{itemLabel(item)}</div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    {Number(item.quantity).toLocaleString()} {item.unit}
                    <StockBadge quantity={Number(item.quantity)} minStock={Number(item.minStock)} />
                  </div>
                </div>
              </div>
              <ArrowRight className="hidden sm:block h-4 w-4 mb-4 text-muted-foreground" />
              <div className="space-y-1.5">
                <Label>Replace with</Label>
                {candidates.length === 0 ? (
                  <p className="text-sm text-muted-foreground rounded-md border px-3 py-2">
                    {item.code ? `No other ${item.unit} item with code ${item.code}.` : 'This item has no code, so it cannot be replaced.'}
                  </p>
                ) : (
                  <Select value={targetId} onValueChange={setTargetId}>
                    <SelectTrigger><SelectValue placeholder="Select replacement" /></SelectTrigger>
                    <SelectContent>
                      {candidates.map(c => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {itemLabel(c)} · {c.quantity.toLocaleString()} {c.unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {recipes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recipe uses this ingredient.</p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Recipes to update ({selected.size}/{recipes.length})</Label>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() =>
                    setSelected(selected.size === recipes.length ? new Set() : new Set(recipes.map(r => r.recipeId)))}>
                    {selected.size === recipes.length ? 'Select none' : 'Select all'}
                  </Button>
                </div>
                <div className="rounded-md border divide-y">
                  {recipes.map(r => (
                    <label key={r.recipeId} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-accent/30">
                      <Checkbox checked={selected.has(r.recipeId)} onCheckedChange={() => toggle(r.recipeId)} />
                      <span className="flex-1">
                        {r.recipeName}
                        {r.description && <span className="text-xs text-muted-foreground ml-2">{r.description}</span>}
                      </span>
                      <span className="text-muted-foreground tabular-nums">{Number(r.quantity).toLocaleString()} {r.unit}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleReplace} disabled={saving || !target || selected.size === 0}>
            {saving ? 'Replacing…' : `Replace in ${selected.size} recipe${selected.size !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
