import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Shield, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { TableSkeleton, EmptyState } from '@/components/DataStates';
import { useAuth } from '@/contexts/AuthContext';
import { userService } from '@/services/userService';
import { useToast } from '@/hooks/use-toast';
import type { User, UserRole, Permission } from '@/models/types';

const allPermissions: { value: Permission; label: string }[] = [
  { value: 'manage_inventory', label: 'Manage Inventory' },
  { value: 'manage_recipes', label: 'Manage Recipes' },
  { value: 'manage_batches', label: 'Manage Batches' },
  { value: 'manage_sales', label: 'Manage Sales' },
  { value: 'view_analytics', label: 'View Analytics' },
  { value: 'manage_quality', label: 'Manage Quality' },
  { value: 'manage_packaging', label: 'Manage Packaging' },
  { value: 'manage_users', label: 'Manage Users' },
];

const roleBadgeClass: Record<UserRole, string> = {
  admin: 'bg-primary text-primary-foreground',
  supervisor: 'bg-info text-info-foreground',
  operator: 'bg-muted text-muted-foreground',
};

export default function UserManagement() {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editPerms, setEditPerms] = useState<Permission[]>([]);
  const [editRole, setEditRole] = useState<UserRole>('operator');

  // Create user form
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('operator');

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await userService.getAll();
      setUsers(data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  if (!hasPermission('manage_users')) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">You don't have permission to manage users.</p>
      </div>
    );
  }

  const openEdit = (u: User) => {
    setEditingUser(u);
    setEditPerms([...(u.permissions || [])]);
    setEditRole(u.role);
  };

  const togglePerm = (perm: Permission) => {
    setEditPerms(prev => prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]);
  };

  const handleSave = async () => {
    if (!editingUser) return;
    try {
      await userService.update(editingUser.id, { role: editRole, permissions: editPerms });
      toast({ title: 'User updated' });
      setEditingUser(null);
      loadUsers();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleCreate = async () => {
    if (!newName || !newEmail || !newPassword) return;
    try {
      await userService.create({ name: newName, email: newEmail, password: newPassword, role: newRole });
      toast({ title: 'User created' });
      setCreateOpen(false);
      setNewName(''); setNewEmail(''); setNewPassword(''); setNewRole('operator');
      loadUsers();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string | number) => {
    try {
      await userService.delete(id);
      toast({ title: 'User deleted', variant: 'destructive' });
      loadUsers();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  if (loading) return <div className="space-y-6"><TableSkeleton /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2"><Users className="h-6 w-6" /> User Management</h1>
          <p className="text-sm text-muted-foreground">Manage user roles and permissions</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" /> New User</Button>
      </div>

      {users.length === 0 ? <EmptyState title="No users" description="Create the first user." icon="👤" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((u, idx) => (
            <motion.div key={u.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.08 }}>
              <Card className="shadow-card">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
                        <span className="text-primary-foreground text-sm font-semibold">{u.name?.split(' ').map((n: string) => n[0]).join('') || '?'}</span>
                      </div>
                      <div>
                        <CardTitle className="text-base">{u.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                    <Badge className={roleBadgeClass[u.role] || ''}>{u.role}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {(u.permissions || []).map((p: string) => (
                      <Badge key={p} variant="outline" className="text-[10px]">{p.replace('manage_', '').replace('view_', '')}</Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(u)}>
                      <Shield className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm"><Trash2 className="h-3 w-3 text-destructive" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Delete {u.name}?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(u.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Edit permissions dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          {editingUser && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">Edit {editingUser.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Role</label>
                  <Select value={editRole} onValueChange={v => setEditRole(v as UserRole)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                      <SelectItem value="operator">Operator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Permissions</label>
                  <div className="grid grid-cols-2 gap-2">
                    {allPermissions.map(p => (
                      <label key={p.value} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox checked={editPerms.includes(p.value)} onCheckedChange={() => togglePerm(p.value)} />
                        {p.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
                <Button onClick={handleSave}>Save Changes</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create user dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Create User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label>Name</Label><Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="John Doe" /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="john@fromagerie.com" /></div>
            <div className="space-y-1.5"><Label>Password</Label><Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" /></div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={newRole} onValueChange={v => setNewRole(v as UserRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="operator">Operator</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
