import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

type CaregiverRow = {
  id: number;
  name: string;
  email: string;
  linked_patient_count: string | number;
};

export default function CaregiversPage() {
  const { user } = useAuth();
  const [caregivers, setCaregivers] = useState<CaregiverRow[]>([]);
  const [loading, setLoading] = useState(true);

  const hasPermission = (permissionName: string) =>
    Array.isArray(user?.permissions) && user.permissions.includes(permissionName);

  const canViewCaregivers = user?.role === 'admin' || hasPermission('MANAGE_USERS');

  useEffect(() => {
    if (user && canViewCaregivers) {
      void fetchCaregivers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, canViewCaregivers]);

  const fetchCaregivers = async () => {
    try {
      const response = await api.get('/caregivers');
      setCaregivers(response.data.caregivers || []);
    } catch (error) {
      console.error('Error fetching caregivers:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <Navigate to="/login" replace />;
  if (!canViewCaregivers) return <Navigate to="/dashboard" replace />;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center mb-8">
        <Users className="h-8 w-8 text-primary-600 mr-3" />
        <h1 className="text-3xl font-bold text-gray-900">Caregivers</h1>
      </div>

      {caregivers.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-600">No caregivers found</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Name</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Email</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Linked Patients</th>
              </tr>
            </thead>
            <tbody>
              {caregivers.map((c) => (
                <tr key={c.id} className="border-b last:border-b-0">
                  <td className="py-3 px-4 text-gray-900">{c.name}</td>
                  <td className="py-3 px-4 text-gray-700">{c.email}</td>
                  <td className="py-3 px-4 text-gray-700">{Number(c.linked_patient_count) || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
