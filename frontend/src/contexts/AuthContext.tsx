import React, { createContext, useContext, useState } from 'react';
import { User, Permission, UserRole } from '@/models/types';
import { mockUsers } from '@/data/mockData';

interface AuthContextType {
  user: User;
  isAuthenticated: boolean;
  hasPermission: (permission: Permission) => boolean;
  setRole: (role: UserRole) => void;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  allUsers: User[];
  updateUserRole: (userId: string, role: UserRole) => void;
  updateUserPermissions: (userId: string, permissions: Permission[]) => void;
}

const rolePermissions: Record<UserRole, Permission[]> = {
  admin: ['manage_inventory', 'manage_recipes', 'manage_batches', 'manage_sales', 'view_analytics', 'manage_quality', 'manage_packaging', 'manage_users'],
  supervisor: ['manage_inventory', 'manage_recipes', 'manage_batches', 'view_analytics', 'manage_quality'],
  operator: ['manage_batches', 'manage_quality'],
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(mockUsers[0]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [users, setUsers] = useState<User[]>([...mockUsers]);

  const hasPermission = (permission: Permission) => user.permissions.includes(permission);

  const setRole = (role: UserRole) => {
    setUser(prev => ({ ...prev, role, permissions: rolePermissions[role] }));
  };

  const login = (email: string, _password: string) => {
    const found = users.find(u => u.email === email);
    if (found) {
      setUser(found);
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
  };

  const updateUserRole = (userId: string, role: UserRole) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role, permissions: rolePermissions[role] } : u));
    if (user.id === userId) setRole(role);
  };

  const updateUserPermissions = (userId: string, permissions: Permission[]) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, permissions } : u));
    if (user.id === userId) setUser(prev => ({ ...prev, permissions }));
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, hasPermission, setRole, login, logout, allUsers: users, updateUserRole, updateUserPermissions }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
