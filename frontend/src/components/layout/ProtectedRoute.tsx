import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Permission } from '@/models/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  permissions?: Permission[];
}

export function ProtectedRoute({ children, permissions = [] }: ProtectedRouteProps) {
  const { isAuthenticated, hasPermission, isLoading } = useAuth();

  if (isLoading) return null;
  
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (permissions.length === 0) {
    return <>{children}</>;
  }

  const isAuthorized = permissions.every(p => hasPermission(p));
  
  if (!isAuthorized) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
