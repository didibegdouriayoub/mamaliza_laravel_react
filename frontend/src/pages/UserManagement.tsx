import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Shield, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { TableSkeleton, EmptyState } from '@/components/DataStates';
import { useAuth } from '@/contexts/AuthContext';
import { userService } from '@/services/userService';
import { useToast } from '@/hooks/use-toast';
import type { User, UserRole, Permission } from '@/models/types';

// ── Page-based permission map ─────────────────────────────────────────────────
const PAGE_PERMISSIONS: { page: string; read: Permission; write: Permission | null }[] = [
  { page: 'Dashboard / Analytics', read: 'analytics.read',    write: null },
  { page: 'Inventory',             read: 'inventory.read',    write: 'inventory.write' },
  { page: 'Recipes',               read: 'recipes.read',      write: 'recipes.write' },
  { page: 'Batches',               read: 'batches.read',      write: 'batches.write' },
  { page: 'Quality',               read: 'quality.read',      write: 'quality.write' },
  { page: 'Estimation',            read: 'estimation.read',   write: 'estimation.write' },
  { page: 'Sales',                 read: 'sales.read',        write: 'sales.write' },
  { page: 'Suppliers',             read: 'suppliers.read',    write: 'suppliers.write' },
  { page: 'Customers',             read: 'customers.read',    write: 'customers.write' },
  { page: 'Packaging',             read: 'packaging.read',    write: 'packaging.write' },
  { page: 'Storage',               read: 'storage.read',      write: 'storage.write' },
  { page: 'Users',                 read: 'users.read',        write: 'users.write' },
  { page: 'Permissions',           read: 'permissions.read',  write: 'permissions.write' },
];

type Level = 'none' | 'read' | 'write';

function getLevel(perms: Permission[], row: typeof PAGE_PERMISSIONS[0]): Level {
  if (row.write && perms.includes(row.write)) return 'write';
  if (perms.includes(row.read)) return 'read';
  return 'none';
}

function applyLevel(perms: Permission[], row: typeof PAGE_PERMISSIONS[0], level: Level): Permission[] {
  const base = perms.filter(p => p !== row.read && p !== row.write);
  if (level === 'read')  return [...base, row.read];
  if (level === 'write') return row.write ? [...base, row.write] : [...base, row.read];
  return base;
}

const roleBadgeClass: Record<UserRole, string> = {
  admin:      'bg-primary text-primary-foreground',
  supervisor: 'bg-info text-info-foreground',
  operator:   'bg-muted text-muted-foreground',
};

export default function UserManagement() {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editPerms, setEditPerms] = useState<Permission[]>([]);
  const [editRole, setEditRole] = useState<UserRole>('operator');

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('operator');

  const loadData = async () => {
    setLoading(true);
    try {
      const userData = await userService.getAll();
      const parsed = (userData || []).map((u: any) => {
        let perms = u.permissions;
        if (typeof perms === 'string') { try { perms = JSON.parse(perms); } catch { perms = []; } }
        return { ...u, permissions: Array.isArray(perms) ? perms : [] };
      });
      setUsers(parsed);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  if (!hasPermission('users.read')) {
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

  const handleSave = async () => {
    if (!editingUser) return;
    try {
      await userService.update(editingUser.id, { role: editRole, permissions: editPerms });
      toast({ title: 'User updated' });
      setEditingUser(null);
      loadData();
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
      loadData();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string | number) => {
    try {
      await userService.delete(id);
      toast({ title: 'User deleted', variant: 'destructive' });
      loadData();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  // Summary label for a user's page access
  const accessSummary = (u: User) => {
    if (u.role === 'admin') return ['All access'];
    const perms = u.permissions || [];
    return PAGE_PERMISSIONS
      .filter(r => perms.includes(r.read) || (r.write && perms.includes(r.write)))
      .map(r => {
        const level = getLevel(perms, r);
        return `${r.page.split('/')[0].trim()} (${level})`;
      });
  };

  if (loading) return <div className="space-y-6"><TableSkeleton /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2"><Users className="h-6 w-6" /> User Management</h1>
          <p className="text-sm text-muted-foreground">Manage user roles and page access</p>
        </div>
        {hasPermission('users.write') && (
          <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" /> New User</Button>
        )}
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
                        <span className="text-primary-foreground text-sm font-semibold">
                          {u.name?.split(' ').map((n: string) => n[0]).join('') || '?'}
                        </span>
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
                  <div className="flex flex-wrap gap-1 mb-3 min-h-[24px]">
                    {accessSummary(u).map(s => (
                      <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
                    ))}
                  </div>
                  {hasPermission('users.write') && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(u)}>
                        <Shield className="h-3 w-3 mr-1" /> Edit Access
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
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Edit user dialog ── */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {editingUser && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">Edit — {editingUser.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-5 py-2">
                {/* Role */}
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select value={editRole} onValueChange={v => setEditRole(v as UserRole)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin (all access)</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                      <SelectItem value="operator">Operator</SelectItem>
                    </SelectContent>
                  </Select>
                  {editRole === 'admin' && (
                    <p className="text-xs text-muted-foreground">Admin has full access to all pages — no need to set individual permissions.</p>
                  )}
                </div>

                {/* Page access grid */}
                {editRole !== 'admin' && (
                  <div className="space-y-2">
                    <Label>Page Access</Label>
                    <div className="border rounded-md overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50 text-xs text-muted-foreground">
                            <th className="text-left px-3 py-2 font-medium">Page</th>
                            <th className="text-center px-2 py-2 font-medium w-16">None</th>
                            <th className="text-center px-2 py-2 font-medium w-16">Read</th>
                            <th className="text-center px-2 py-2 font-medium w-16">Write</th>
                          </tr>
                        </thead>
                        <tbody>
                          {PAGE_PERMISSIONS.map((row, i) => {
                            const level = getLevel(editPerms, row);
                            return (
                              <tr key={row.page} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                                <td className="px-3 py-2 font-medium">{row.page}</td>
                                {(['none', 'read', 'write'] as Level[]).map(lvl => (
                                  <td key={lvl} className="text-center px-2 py-2">
                                    {(lvl !== 'write' || row.write) && (
                                      <input
                                        type="radio"
                                        name={`perm-${row.page}`}
                                        checked={level === lvl}
                                        onChange={() => setEditPerms(applyLevel(editPerms, row, lvl))}
                                        className="accent-primary cursor-pointer"
                                      />
                                    )}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-muted-foreground">Write includes create, update, and delete. Read is view-only.</p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
                <Button onClick={handleSave}>Save Changes</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Create user dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Create User</DialogTitle></DialogHeader>
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
