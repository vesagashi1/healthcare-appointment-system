import { useEffect, useState } from 'react';
import { UserCircle2, Mail, CalendarDays, Droplets, Building2 } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import DatePicker from '../components/DatePicker';
import { format } from 'date-fns';

interface PatientProfile {
  id: number;
  user_id: number;
  name: string;
  email: string;
  date_of_birth?: string | null;
  gender?: string | null;
  blood_type?: string | null;
  ward_id?: number | null;
  ward_name?: string | null;
  created_at?: string;
}

const labelClass = 'text-xs uppercase tracking-wide text-slate-400';
const valueClass = 'text-sm font-medium text-slate-100';

const MyProfilePage = () => {
  const toast = useToast();
  const { updateUser } = useAuth();
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    date_of_birth: '',
    gender: '',
    blood_type: '',
  });

  const fetchProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/patients/my-profile/details');
      const patient = response.data.patient || null;
      setProfile(patient);
      setForm({
        name: patient?.name || '',
        email: patient?.email || '',
        date_of_birth: patient?.date_of_birth ? String(patient.date_of_birth).slice(0, 10) : '',
        gender: patient?.gender || '',
        blood_type: patient?.blood_type || '',
      });
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to load profile details';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        blood_type: form.blood_type || null,
      };

      const response = await api.patch('/patients/my-profile/details', payload);
      const updated = response.data.patient as PatientProfile;
      setProfile(updated);
      setForm({
        name: updated?.name || '',
        email: updated?.email || '',
        date_of_birth: updated?.date_of_birth ? String(updated.date_of_birth).slice(0, 10) : '',
        gender: updated?.gender || '',
        blood_type: updated?.blood_type || '',
      });
      updateUser({ name: updated.name, email: updated.email });
      setEditing(false);
      toast.success('Profile updated successfully');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <UserCircle2 className="h-8 w-8 text-primary-600" />
        <h1 className="text-3xl font-bold text-slate-100">My Profile</h1>
      </div>

      {error ? (
        <div className="card">
          <p className="text-rose-200 mb-4">{error}</p>
          <button className="btn-secondary" onClick={fetchProfile} type="button">
            Retry
          </button>
        </div>
      ) : (
        <div className="card max-w-3xl">
          <div className="flex items-center gap-4 pb-5 mb-5 border-b border-slate-700/60">
            <div className="h-14 w-14 rounded-full bg-primary-500/15 border border-primary-500/25 flex items-center justify-center">
              <UserCircle2 className="h-8 w-8 text-primary-300" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-100">{profile?.name || '-'}</h2>
              <p className="text-slate-300">Patient account details</p>
            </div>
            <div className="ml-auto">
              {!editing ? (
                <button type="button" className="btn-secondary" onClick={() => setEditing(true)}>
                  Edit Profile
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setEditing(false);
                    setForm({
                      name: profile?.name || '',
                      email: profile?.email || '',
                      date_of_birth: profile?.date_of_birth
                        ? String(profile.date_of_birth).slice(0, 10)
                        : '',
                      gender: profile?.gender || '',
                      blood_type: profile?.blood_type || '',
                    });
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          {editing ? (
            <form className="grid grid-cols-1 md:grid-cols-2 gap-5" onSubmit={handleSave}>
              <div>
                <p className={labelClass}>Full Name</p>
                <input
                  className="input-field mt-1"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <p className={labelClass}>Email</p>
                <input
                  className="input-field mt-1"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>
              <div>
                <p className={labelClass}>Date of Birth</p>
                <DatePicker
                  selected={form.date_of_birth ? new Date(form.date_of_birth + 'T00:00:00') : null}
                  onChange={(date) => setForm((prev) => ({ ...prev, date_of_birth: date ? format(date, 'yyyy-MM-dd') : '' }))}
                  placeholderText="Select date of birth"
                  className="mt-1"
                />
              </div>
              <div>
                <p className={labelClass}>Gender</p>
                <select
                  className="input-field mt-1"
                  value={form.gender}
                  onChange={(e) => setForm((prev) => ({ ...prev, gender: e.target.value }))}
                >
                  <option value="">Not set</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <p className={labelClass}>Blood Type</p>
                <select
                  className="input-field mt-1"
                  value={form.blood_type}
                  onChange={(e) => setForm((prev) => ({ ...prev, blood_type: e.target.value }))}
                >
                  <option value="">Not set</option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bt) => (
                    <option key={bt} value={bt}>
                      {bt}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className={labelClass}>Ward</p>
                <p className={valueClass}>
                  <Building2 className="inline h-4 w-4 mr-1 text-slate-300" />
                  {profile?.ward_name || 'Not assigned'}
                </p>
              </div>
              <div className="md:col-span-2 flex justify-end">
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <p className={labelClass}>Email</p>
              <p className={valueClass}>
                <Mail className="inline h-4 w-4 mr-1 text-slate-300" />
                {profile?.email || '-'}
              </p>
            </div>
            <div>
              <p className={labelClass}>Ward</p>
              <p className={valueClass}>
                <Building2 className="inline h-4 w-4 mr-1 text-slate-300" />
                {profile?.ward_name || 'Not assigned'}
              </p>
            </div>
            <div>
              <p className={labelClass}>Date of Birth</p>
              <p className={valueClass}>
                <CalendarDays className="inline h-4 w-4 mr-1 text-slate-300" />
                {profile?.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString() : 'Not set'}
              </p>
            </div>
            <div>
              <p className={labelClass}>Gender</p>
              <p className={valueClass}>{profile?.gender || 'Not set'}</p>
            </div>
            <div>
              <p className={labelClass}>Blood Type</p>
              <p className={valueClass}>
                <Droplets className="inline h-4 w-4 mr-1 text-slate-300" />
                {profile?.blood_type || 'Not set'}
              </p>
            </div>
            <div>
              <p className={labelClass}>Member Since</p>
              <p className={valueClass}>
                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '-'}
              </p>
            </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MyProfilePage;
