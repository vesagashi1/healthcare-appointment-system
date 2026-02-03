import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';
import type { Role } from './authTypes';

type Props = {
  requireRole?: Role;
};

export function ProtectedRoute({ requireRole }: Props) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (requireRole && user.role !== requireRole) return <Navigate to="/" replace />;

  return <Outlet />;
}
