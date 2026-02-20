import { useState, useEffect } from 'react';
import api from '../services/api';
import { Stethoscope } from 'lucide-react';

interface Doctor {
  id: number;
  name: string;
  email: string;
  specialization: string;
}

const DoctorsPage = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    try {
      const response = await api.get('/doctors');
      setDoctors(response.data.doctors || []);
    } catch (error) {
      console.error('Error fetching doctors:', error);
    } finally {
      setLoading(false);
    }
  };

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
        <Stethoscope className="h-8 w-8 text-primary-600 mr-3" />
        <h1 className="text-3xl font-bold text-gray-900">Doctors</h1>
      </div>

      {doctors.length === 0 ? (
        <div className="card text-center py-12">
          <Stethoscope className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No doctors found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {doctors.map((doctor) => (
            <div key={doctor.id} className="card hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{doctor.name}</h3>
                  <p className="text-sm text-gray-600">{doctor.email}</p>
                </div>
                <div className="bg-purple-100 p-2 rounded-full">
                  <Stethoscope className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <div className="mt-4">
                <span className="inline-block px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                  {doctor.specialization}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DoctorsPage;
