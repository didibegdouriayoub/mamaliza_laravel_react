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
    return (
      <div className="flex flex-col items-center justify-center h-full py-24 text-center gap-3">
        <p className="text-4xl">🔒</p>
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p className="text-sm text-muted-foreground">
          You don't have permission to view this page.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
