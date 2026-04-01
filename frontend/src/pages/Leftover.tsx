import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Recycle, Search, Save, Edit2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TableSkeleton, EmptyState } from '@/components/DataStates';
import { batchGroupService } from '@/services/batchService';
import { BatchGroup } from '@/models/types';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const UNITS = ['kg', 'g', 'L', 'mL', 'pcs'];

export default function Leftover() {
  const [groups, setGroups] = useState<BatchGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editUnit, setEditUnit] = useState('kg');
  const [saving, setSaving] = useState(false);
  const { hasPermission } = useAuth();
  const { toast } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await batchGroupService.getAll();
      setGroups((data || []).map((g: any) => ({
        ...g,
        recipeId: String(g.recipeId ?? g.recipe_id ?? ''),
        recipeName: g.recipeName ?? g.recipe_name ?? '',
        batchCount: Number(g.batchCount ?? g.batch_count) || 0,
        targetWeight: Number(g.targetWeight ?? g.target_weight) || 0,
        leftoverQty: g.leftoverQty != null ? Number(g.leftoverQty) : undefined,
        leftoverUnit: g.leftoverUnit ?? g.leftover_unit ?? 'kg',
        createdAt: (g.createdAt ?? g.created_at ?? '').split('T')[0],
      })));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const startEdit = (group: BatchGroup) => {
    setEditingId(group.id);
    setEditQty(group.leftoverQty != null ? String(group.leftoverQty) : '');
    setEditUnit(group.leftoverUnit ?? 'kg');
  };

  const handleSave = async (groupId: string) => {
    if (!editQty.trim()) return;
    setSaving(true);
    try {
      await batchGroupService.updateStats(groupId, {
        leftoverQty: Number(editQty),
        leftoverUnit: editUnit,
      });
      toast({ title: 'Leftover saved', description: `${editQty} ${editUnit} recorded. Leftover inventory updated.` });
      setEditingId(null);
      loadData();
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const filtered = search.trim()
    ? groups.filter(g => g.recipeName.toLowerCase().includes(search.toLowerCase()))
    : groups;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Recycle className="h-6 w-6" /> Leftover
          </h1>
          <p className="text-sm text-muted-foreground">Record leftover materials per batch group</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9 w-52" placeholder="Search by recipe..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-0">
          {loading ? <div className="p-4"><TableSkeleton /></div> : filtered.length === 0 ? (
            <EmptyState title="No batch groups found" description="Create batch groups first to record leftover." icon="♻️" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Recipe</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="hidden sm:table-cell">Batches</TableHead>
                  <TableHead className="hidden md:table-cell">Target (kg)</TableHead>
                  <TableHead>Leftover</TableHead>
                  {hasPermission('batches.write') && <TableHead className="text-right pr-4">Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((group, idx) => (
                  <motion.tr
                    key={group.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.03 }}
                    className="border-b last:border-0"
                  >
                    <TableCell className="pl-4 font-medium">{group.recipeName}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{group.createdAt}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm">{group.batchCount}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">
                      {(group.targetWeight * group.batchCount).toLocaleString()} kg
                    </TableCell>
                    <TableCell>
                      {editingId === group.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            className="h-8 w-24 text-sm"
                            value={editQty}
                            onChange={e => setEditQty(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSave(group.id)}
                            autoFocus
                            placeholder="0.00"
                          />
                          <Select value={editUnit} onValueChange={setEditUnit}>
                            <SelectTrigger className="h-8 w-16 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : group.leftoverQty != null ? (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                          {group.leftoverQty} {group.leftoverUnit}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Not filled</Badge>
                      )}
                    </TableCell>
                    {hasPermission('batches.write') && (
                      <TableCell className="text-right pr-4">
                        {editingId === group.id ? (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingId(null)}>Cancel</Button>
                            <Button size="sm" className="h-7 text-xs" onClick={() => handleSave(group.id)} disabled={saving || !editQty.trim()}>
                              <Save className="h-3 w-3 mr-1" /> Save
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => startEdit(group)}>
                            <Edit2 className="h-3 w-3 mr-1" />
                            {group.leftoverQty != null ? 'Edit' : 'Fill'}
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
