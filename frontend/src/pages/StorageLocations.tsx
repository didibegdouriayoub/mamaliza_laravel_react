import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Plus, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { TableSkeleton, EmptyState } from '@/components/DataStates';
import { storageLocationService, type StorageLocation } from '@/services/storageLocationService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const LOCATION_TYPES = ['Fridge', 'Room Temp', 'Workbench', 'Other'] as const;
type LocationType = typeof LOCATION_TYPES[number];

const typeBadge: Record<LocationType, string> = {
  Fridge:     'bg-blue-100 text-blue-800',
  'Room Temp':'bg-amber-100 text-amber-800',
  Workbench:  'bg-purple-100 text-purple-800',
  Other:      'bg-gray-100 text-gray-700',
};

const emptyForm = () => ({ name: '', type: 'Fridge' as LocationType, temperatureRequired: '', capacity: '' });

export default function StorageLocations() {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StorageLocation | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const canWrite = hasPermission('storage.write');

  const load = async () => {
    setLoading(true);
    try { setLocations(await storageLocationService.getAll()); } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setDialogOpen(true); };
  const openEdit = (l: StorageLocation) => {
    setEditing(l);
    setForm({ name: l.name, type: l.type, temperatureRequired: l.temperatureRequired ?? '', capacity: l.capacity ?? '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        temperatureRequired: form.temperatureRequired.trim() || null,
        capacity: form.capacity.trim() || null,
      };
      if (editing) {
        await storageLocationService.update(editing.id, payload);
        toast({ title: 'Location updated' });
      } else {
        await storageLocationService.create(payload);
        toast({ title: 'Location created' });
      }
      setDialogOpen(false);
      load();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    try {
      await storageLocationService.delete(id);
      toast({ title: 'Location deleted', variant: 'destructive' });
      load();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  if (!hasPermission('storage.read')) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">You don't have permission to view storage.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <MapPin className="h-6 w-6" /> Storage Locations
          </h1>
          <p className="text-sm text-muted-foreground">Define all storage spots and their properties</p>
        </div>
        {canWrite && (
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> New Location</Button>
        )}
      </div>

      {loading ? <TableSkeleton /> : locations.length === 0 ? (
        <EmptyState title="No locations" description="Add the first storage location." icon="🏪" />
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Location Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="hidden sm:table-cell">Temperature Required</TableHead>
                <TableHead className="hidden md:table-cell">Capacity</TableHead>
                {canWrite && <TableHead className="text-right pr-4">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.map((loc, idx) => (
                <motion.tr
                  key={loc.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.04 }}
                  className="border-b last:border-0"
                >
                  <TableCell className="pl-4 font-medium">{loc.name}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${typeBadge[loc.type] || 'bg-gray-100 text-gray-700'}`}>
                      {loc.type}
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {loc.temperatureRequired || '—'}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {loc.capacity || '—'}
                  </TableCell>
                  {canWrite && (
                    <TableCell className="text-right pr-4">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(loc)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete "{loc.name}"?</AlertDialogTitle>
                              <AlertDialogDescription>This will remove the location permanently.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(loc.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  )}
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? 'Edit Location' : 'New Location'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Location Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Main Fridge A" />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as LocationType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LOCATION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Temperature Required <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input value={form.temperatureRequired} onChange={e => setForm(f => ({ ...f, temperatureRequired: e.target.value }))} placeholder="e.g. 2–4 °C" />
            </div>
            <div className="space-y-1.5">
              <Label>Capacity <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} placeholder="e.g. 500 kg" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
