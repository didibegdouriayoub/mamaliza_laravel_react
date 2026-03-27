import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Plus, Trash2, Edit } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { TableSkeleton, EmptyState } from '@/components/DataStates';
import { permissionService, PermissionEntity } from '@/services/permissionService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export default function Permissions() {
  const [permissions, setPermissions] = useState<PermissionEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPermission, setEditingPermission] = useState<PermissionEntity | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const { hasPermission } = useAuth();
  const { toast } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await permissionService.getAll();
      setPermissions(data || []);
    } catch (e) {
      console.error(e);
      toast({ title: 'Failed to load permissions', variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  if (!hasPermission('permissions.read')) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">You don't have permission to view permissions.</p>
      </div>
    );
  }

  const openCreate = () => {
    setEditingPermission(null);
    setName('');
    setDescription('');
    setDialogOpen(true);
  };

  const openEdit = (permission: PermissionEntity) => {
    setEditingPermission(permission);
    setName(permission.name);
    setDescription(permission.description || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    
    try {
      if (editingPermission) {
        await permissionService.update(String(editingPermission.id), { name, description });
        toast({ title: 'Permission updated', description: `${name} has been updated.` });
      } else {
        await permissionService.create({ name, description });
        toast({ title: 'Permission created', description: `${name} has been added.` });
      }
      setDialogOpen(false);
      loadData();
    } catch (e: any) {
      toast({ title: 'Error saving permission', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string | number) => {
    try {
      await permissionService.delete(id);
      toast({ title: 'Permission deleted', variant: 'destructive' });
      loadData();
    } catch (e: any) {
      toast({ title: 'Error deleting permission', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2"><ShieldCheck className="h-6 w-6" /> Permissions</h1>
          <p className="text-sm text-muted-foreground">Manage system permissions that can be assigned to users</p>
        </div>
        {hasPermission('permissions.write') && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Add Permission</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">{editingPermission ? 'Edit Permission' : 'Add New Permission'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. manage_reports" />
                  <p className="text-xs text-muted-foreground mt-1">Use lowercase and underscores (e.g. manage_inventory)</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Grants access to run reports" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSave}>{editingPermission ? 'Update' : 'Create'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="shadow-card">
        <CardContent className="p-0">
          {loading ? <div className="p-4"><TableSkeleton /></div> : permissions.length === 0 ? (
            <div className="p-4"><EmptyState title="No permissions found" description="Add a permission to get started." icon="🔐" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Permission Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permissions.map((permission, idx) => (
                    <motion.tr key={permission.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.05 }} className="border-b">
                      <TableCell className="font-medium font-mono text-sm">{permission.name}</TableCell>
                      <TableCell className="text-muted-foreground">{permission.description || '—'}</TableCell>
                      <TableCell className="text-right">
                        {hasPermission('permissions.write') && (
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(permission)}>
                              <Edit className="h-4 w-4 text-foreground" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete {permission.name}?</AlertDialogTitle>
                                  <AlertDialogDescription>If this permission is removed, users who have it may lose access to certain features. Are you sure?</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(permission.id)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
