import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ClipboardList, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { TableSkeleton, EmptyState } from '@/components/DataStates';
import { packagingLogService } from '@/services/packagingLogService';
import { packagingCartonService } from '@/services/packagingCartonService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { PackagingLog as PackagingLogType, PackagingCarton } from '@/models/types';
import { formatDate } from '@/lib/formatDate';

const today = () => new Date().toISOString().slice(0, 10);

export default function PackagingLog() {
  const [logs, setLogs] = useState<PackagingLogType[]>([]);
  const [cartons, setCartons] = useState<PackagingCarton[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [cartonId, setCartonId] = useState('');
  const [date, setDate] = useState(today());
  const [cartonsCount, setCartonsCount] = useState<number | string>(0);
  const [loosePieces, setLoosePieces] = useState<number | string>(0);
  const [notes, setNotes] = useState('');

  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const canWrite = hasPermission('inventory.write');

  const load = async () => {
    setLoading(true);
    try {
      const [logsData, cartonsData] = await Promise.all([
        packagingLogService.getAll(),
        packagingCartonService.getAll(),
      ]);
      setLogs(logsData || []);
      setCartons(cartonsData || []);
      if (!cartonId && (cartonsData || []).length > 0) {
        setCartonId(String(cartonsData[0].id));
      }
    } catch {
      toast({ title: 'Failed to load packaging log', variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    if (!cartonId) {
      toast({ title: 'Please select a carton type', variant: 'destructive' });
      return;
    }
    if (!date) {
      toast({ title: 'Date is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await packagingLogService.create({
        cartonId,
        date,
        cartonsCount: Number(cartonsCount),
        loosePieces: Number(loosePieces),
        notes: notes || null,
      });
      toast({ title: 'Log recorded — stock deducted automatically' });
      setCartonsCount(0);
      setLoosePieces(0);
      setNotes('');
      setDate(today());
      load();
    } catch (e: any) {
      toast({ title: e.message || 'Failed to save log', variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDelete = async (id: string | number) => {
    try {
      await packagingLogService.delete(id);
      toast({ title: 'Log deleted — stock restored' });
      load();
    } catch (e: any) {
      toast({ title: e.message || 'Delete failed', variant: 'destructive' });
    }
  };

  const getCartonName = (id: string | number) =>
    cartons.find(c => String(c.id) === String(id))?.name ?? `#${id}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <ClipboardList className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Packaging Log</h1>
          <p className="text-sm text-muted-foreground">
            Record daily packaging runs — materials are deducted from stock automatically
          </p>
        </div>
      </div>

      {/* Entry form */}
      {canWrite && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Entry</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <Label>Carton Type *</Label>
                <Select value={cartonId} onValueChange={setCartonId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select carton…" />
                  </SelectTrigger>
                  <SelectContent>
                    {cartons.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name} — {c.productName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Date *</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Cartons Count</Label>
                <Input type="number" min={0} value={cartonsCount}
                  onChange={e => setCartonsCount(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Loose Pieces</Label>
                <Input type="number" min={0} value={loosePieces}
                  onChange={e => setLoosePieces(e.target.value)} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Notes</Label>
                <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>
            <div className="mt-4">
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? 'Saving…' : 'Record & Deduct Stock'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Log table — last 30 days */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Logs (last 30 days)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton />
          ) : logs.length === 0 ? (
            <EmptyState message="No packaging logs in the last 30 days" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Carton</TableHead>
                  <TableHead className="text-right">Cartons</TableHead>
                  <TableHead className="text-right">Loose Pcs</TableHead>
                  <TableHead>Notes</TableHead>
                  {canWrite && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map(l => (
                  <TableRow key={l.id}>
                    <TableCell>{formatDate(l.date)}</TableCell>
                    <TableCell className="font-medium">
                      {l.carton?.name ?? getCartonName(l.cartonId)}
                    </TableCell>
                    <TableCell className="text-right">{l.cartonsCount}</TableCell>
                    <TableCell className="text-right">{l.loosePieces}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-xs truncate">
                      {l.notes ?? '—'}
                    </TableCell>
                    {canWrite && (
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" className="text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete log entry?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Deleting this log will restore the deducted stock back to the
                                packaging materials. This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(l.id)}>
                                Delete & Restore Stock
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
