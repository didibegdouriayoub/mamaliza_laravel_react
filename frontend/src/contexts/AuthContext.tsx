import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Permission, UserRole } from '@/models/types';
import { authService } from '@/services/authService';
import { setAuthToken, removeAuthToken } from '@/lib/apiClient';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasPermission: (permission: Permission) => boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize session on mount
  useEffect(() => {
    const initSession = async () => {
      try {
        const me = await authService.getMe();
        if (me) {
          setUser(me);
          setIsAuthenticated(true);
        }
      } catch (err) {
        // Token invalid or missing
        removeAuthToken();
      } finally {
        setIsLoading(false);
      }
    };

    initSession();

    // Listen for unauthorized events globally (from apiClient)
    const handleUnauthorized = () => {
      setUser(null);
      setIsAuthenticated(false);
      removeAuthToken();
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const hasPermission = (permission: Permission) => {
    if (!user) return false;
    // Basic catch-all for admin (if permissions schema was pure roles, but we'll use array check)
    if (user.role === 'admin') return true;
    return user.permissions?.includes(permission) || false;
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await authService.login(email, password);
      const token = response?.token || response?.access_token;
      if (token) {
        setAuthToken(token);
        // Fetch user object
        const me = await authService.getMe();
        setUser(me);
        setIsAuthenticated(true);
        return true;
      }
      return false;
    } catch (err: any) {
      toast.error(err.message || "Invalid credentials");
      return false;
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch(e) { /* ignore on logout */ }
    
    removeAuthToken();
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoading, hasPermission, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
