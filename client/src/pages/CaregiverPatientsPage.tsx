import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Users, User } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

type CaregiverPatient = {
  id: number;
  user_id: number;
  name: string;
  email: string;
  ward_id: number | null;
  ward_name: string | null;
  relationship: string;
  linked_at: string;
};

export default function CaregiverPatientsPage() {
  const { user } = useAuth();
  const [patients, setPatients] = useState<CaregiverPatient[]>([]);
  const [loading, setLoading] = useState(true);

  const canViewMyPatients =
    user?.role === 'caregiver' && (!Array.isArray(user?.permissions) || user.permissions.includes('VIEW_PATIENT_RECORD'));

  useEffect(() => {
    if (canViewMyPatients) {
      void fetchMyPatients();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewMyPatients]);

  const fetchMyPatients = async () => {
    try {
      const response = await api.get('/caregivers/my-patients');
      setPatients(response.data.patients || []);
    } catch (error) {
      console.error('Error fetching caregiver patients:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <Navigate to="/login" replace />;
  if (!canViewMyPatients) return <Navigate to="/dashboard" replace />;

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
        <h1 className="text-3xl font-bold text-gray-900">My Patients</h1>
      </div>

      {patients.length === 0 ? (
        <div className="card text-center py-12">
          <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No linked patients found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {patients.map((patient) => (
            <div key={patient.id} className="card hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{patient.name}</h3>
                  <p className="text-sm text-gray-600">{patient.email}</p>
                </div>
                <div className="bg-primary-100 p-2 rounded-full">
                  <User className="h-6 w-6 text-primary-600" />
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Relationship:</span>
                  <span className="font-medium capitalize">{patient.relationship}</span>
                </div>
                {patient.ward_name && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Ward:</span>
                    <span className="font-medium">{patient.ward_name}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
