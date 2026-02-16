import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Plus, Check, X, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface Appointment {
  id: number;
  appointment_date: string;
  status: string;
  doctor_name: string;
  patient_name: string;
  doctor_id?: number;
}

const AppointmentsPage = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAppointment, setNewAppointment] = useState({
    doctor_id: '',
    appointment_date: '',
  });

  useEffect(() => {
    fetchAppointments();
    if (user?.role === 'patient') {
      fetchDoctors();
    }
  }, [user]);

  const fetchAppointments = async () => {
    try {
      const response = await api.get('/appointments/my-appointments/list');
      setAppointments(response.data.appointments || []);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctors = async () => {
    try {
      const response = await api.get('/doctors');
      setDoctors(response.data.doctors || []);
    } catch (error) {
      console.error('Error fetching doctors:', error);
    }
  };

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/appointments', newAppointment);
      setShowCreateModal(false);
      setNewAppointment({ doctor_id: '', appointment_date: '' });
      fetchAppointments();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to create appointment');
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await api.patch(`/appointments/${id}/approve`);
      fetchAppointments();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to approve appointment');
    }
  };

  const handleCancel = async (id: number) => {
    try {
      await api.patch(`/appointments/${id}/cancel`);
      fetchAppointments();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to cancel appointment');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
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
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Appointments</h1>
        {user?.role === 'patient' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center"
          >
            <Plus className="mr-2 h-5 w-5" />
            Book Appointment
          </button>
        )}
      </div>

      {appointments.length === 0 ? (
        <div className="card text-center py-12">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No appointments found</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {appointments.map((appointment) => (
            <div key={appointment.id} className="card">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center mb-2">
                    <Clock className="h-5 w-5 text-gray-400 mr-2" />
                    <span className="font-semibold text-lg">
                      {format(new Date(appointment.appointment_date), 'PPpp')}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>
                      <span className="font-medium">Doctor:</span> {appointment.doctor_name}
                    </p>
                    {user?.role === 'doctor' && (
                      <p>
                        <span className="font-medium">Patient:</span> {appointment.patient_name}
                      </p>
                    )}
                  </div>
                  <span
                    className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                      appointment.status
                    )}`}
                  >
                    {appointment.status}
                  </span>
                </div>
                <div className="flex gap-2">
                  {user?.role === 'doctor' && appointment.status === 'scheduled' && (
                    <button
                      onClick={() => handleApprove(appointment.id)}
                      className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                      title="Approve"
                    >
                      <Check className="h-5 w-5" />
                    </button>
                  )}
                  {(user?.role === 'patient' || user?.role === 'doctor') &&
                    appointment.status !== 'cancelled' &&
                    appointment.status !== 'completed' && (
                      <button
                        onClick={() => handleCancel(appointment.id)}
                        className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                        title="Cancel"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">Book New Appointment</h2>
            <form onSubmit={handleCreateAppointment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Doctor
                </label>
                <select
                  value={newAppointment.doctor_id}
                  onChange={(e) =>
                    setNewAppointment({ ...newAppointment, doctor_id: e.target.value })
                  }
                  className="input-field"
                  required
                >
                  <option value="">Select a doctor</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name} - {doctor.specialization}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={newAppointment.appointment_date}
                  onChange={(e) =>
                    setNewAppointment({ ...newAppointment, appointment_date: e.target.value })
                  }
                  className="input-field"
                  required
                />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="flex-1 btn-primary">
                  Book Appointment
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentsPage;
