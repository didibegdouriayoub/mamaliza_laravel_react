import { useState, useEffect } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { userService } from '@/services/userService';
import { useToast } from '@/hooks/use-toast';
import type { User, UserRole, Permission } from '@/models/types';

const PAGE_PERMISSIONS: { page: string; read: Permission; write: Permission | null }[] = [
  { page: 'Dashboard / Analytics', read: 'analytics.read',    write: null },
  { page: 'Inventory',             read: 'inventory.read',    write: 'inventory.write' },
  { page: 'Recipes',               read: 'recipes.read',      write: 'recipes.write' },
  { page: 'Batches',               read: 'batches.read',      write: 'batches.write' },
  { page: 'Pieces Produced',       read: 'pieces.read',       write: 'pieces.write' },
  { page: 'Leftover',              read: 'leftover.read',     write: 'leftover.write' },
  { page: 'Quality',               read: 'quality.read',      write: 'quality.write' },
  { page: 'Estimation',            read: 'estimation.read',   write: 'estimation.write' },
  { page: 'Sales',                 read: 'sales.read',        write: 'sales.write' },
  { page: 'Suppliers',             read: 'suppliers.read',    write: 'suppliers.write' },
  { page: 'Customers',             read: 'customers.read',    write: 'customers.write' },
  { page: 'Packaging',             read: 'packaging.read',    write: 'packaging.write' },
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

export default function Permissions() {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [perms, setPerms] = useState<Permission[]>([]);
  const [role, setRole] = useState<UserRole>('operator');
  const [saving, setSaving] = useState(false);

  const loadUsers = async () => {
    try {
      const data = await userService.getAll();
      const parsed = (data || []).map((u: any) => {
        let p = u.permissions;
        if (typeof p === 'string') { try { p = JSON.parse(p); } catch { p = []; } }
        return { ...u, permissions: Array.isArray(p) ? p : [] };
      });
      setUsers(parsed);
    } catch {
      toast({ title: 'Failed to load users', variant: 'destructive' });
    }
  };

  useEffect(() => { loadUsers(); }, []);

  if (!hasPermission('permissions.read')) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">You don't have permission to manage access control.</p>
      </div>
    );
  }

  const selectUser = (id: string) => {
    setSelectedUserId(id);
    const u = users.find(x => String(x.id) === id);
    if (u) {
      setPerms([...(u.permissions || [])]);
      setRole(u.role);
    }
  };

  const handleSave = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    try {
      await userService.update(selectedUserId, { role, permissions: perms });
      toast({ title: 'Access updated successfully' });
      loadUsers();
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const selectedUser = users.find(u => String(u.id) === selectedUserId);
  const isAdmin = role === 'admin';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6" /> Access Control
        </h1>
        <p className="text-sm text-muted-foreground">Select a user and configure which pages they can access</p>
      </div>

      <Card className="shadow-card">
        <CardContent className="pt-6 space-y-6">
          {/* User selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>User</Label>
              <Select value={selectedUserId} onValueChange={selectUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user…" />
                </SelectTrigger>
                <SelectContent>
                  {users.map(u => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name} — {u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedUser && (
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={role} onValueChange={v => setRole(v as UserRole)} disabled={!hasPermission('permissions.write')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin (full access)</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="operator">Operator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Permission grid */}
          {selectedUser && (
            <>
              {isAdmin ? (
                <div className="rounded-md bg-muted/40 border px-4 py-3 text-sm text-muted-foreground">
                  <strong>{selectedUser.name}</strong> is an Admin and has full access to all pages.
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Page Access</Label>
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50 text-xs text-muted-foreground">
                          <th className="text-left px-4 py-2.5 font-medium">Page</th>
                          <th className="text-center px-3 py-2.5 font-medium w-20">No Access</th>
                          <th className="text-center px-3 py-2.5 font-medium w-20">Read only</th>
                          <th className="text-center px-3 py-2.5 font-medium w-20">Read & Write</th>
                        </tr>
                      </thead>
                      <tbody>
                        {PAGE_PERMISSIONS.map((row, i) => {
                          const level = getLevel(perms, row);
                          const canEdit = hasPermission('permissions.write');
                          return (
                            <tr key={row.page} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                              <td className="px-4 py-2.5 font-medium">{row.page}</td>
                              {(['none', 'read', 'write'] as Level[]).map(lvl => (
                                <td key={lvl} className="text-center px-3 py-2.5">
                                  {(lvl !== 'write' || row.write) && (
                                    <input
                                      type="radio"
                                      name={`perm-${row.page}`}
                                      checked={level === lvl}
                                      disabled={!canEdit}
                                      onChange={() => canEdit && setPerms(applyLevel(perms, row, lvl))}
                                      className="accent-primary cursor-pointer w-4 h-4"
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
                  <p className="text-xs text-muted-foreground">
                    <strong>Read</strong> — view only. <strong>Read & Write</strong> — view, create, edit, and delete.
                  </p>
                </div>
              )}

              {hasPermission('permissions.write') && (
                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving…' : `Save Access for ${selectedUser.name}`}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
