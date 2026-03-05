import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  Stethoscope, X, Building2, Users, Plus, Pencil, Ban, RotateCcw, Trash2, CalendarCheck,
  Search,
} from 'lucide-react';

/* ───── types ───── */

interface DoctorListItem {
  id: number;
  user_id: number;
  name: string;
  email: string;
  specialization: string;
  created_at: string;
  ward_count: number | string;
  active: boolean;
}

interface DoctorWard { id: number; name: string; }
interface DoctorPatient { id: number; user_id: number; name: string; email: string; ward_id: number | null; ward_name: string | null; }

interface DoctorDetail {
  id: number;
  user_id: number;
  name: string;
  email: string;
  specialization: string;
  created_at: string;
  active: boolean;
  wards: DoctorWard[];
  assigned_patients: DoctorPatient[];
  appointment_stats: { total: string; scheduled: string; approved: string; completed: string; };
  stats: { ward_count: number; patient_count: number; };
}

interface WardOption { id: number; name: string; }

/* ───── modal ───── */

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className={`bg-slate-950 text-slate-100 w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-lg shadow-lg overflow-hidden border border-slate-800 max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="p-2 rounded hover:bg-slate-900" aria-label="Close">
            <X className="h-5 w-5 text-slate-300" />
          </button>
        </div>
        <div className="px-6 py-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

/* ───── page ───── */

const DoctorsPage = () => {
  const PAGE_SIZE = 9;
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  /* ── list ── */
  const [doctors, setDoctors] = useState<DoctorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchField, setSearchField] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  /* ── detail ── */
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  /* ── create / edit ── */
  const [showForm, setShowForm] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<DoctorListItem | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formSpecialization, setFormSpecialization] = useState('');
  const [formError, setFormError] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  /* ── ward assignment ── */
  const [showAssignWard, setShowAssignWard] = useState(false);
  const [assignDoctorId, setAssignDoctorId] = useState<number | null>(null);
  const [allWards, setAllWards] = useState<WardOption[]>([]);
  const [selectedWardId, setSelectedWardId] = useState<number | ''>('');
  const [assignError, setAssignError] = useState('');

  useEffect(() => { fetchDoctors(); }, []);

  /* ── data fetching ── */

  const fetchDoctors = async () => {
    try {
      const res = await api.get('/doctors');
      setDoctors(res.data.doctors || []);
    } catch (err) { console.error('Error fetching doctors:', err); }
    finally { setLoading(false); }
  };

  const openDetail = async (doctorId: number) => {
    setShowDetail(true);
    setSelectedDoctor(null);
    setLoadingDetail(true);
    try {
      const res = await api.get(`/doctors/${doctorId}`);
      setSelectedDoctor(res.data.doctor || null);
    } catch (err) { console.error('Error fetching doctor details:', err); }
    finally { setLoadingDetail(false); }
  };

  const closeDetail = () => { setShowDetail(false); setSelectedDoctor(null); };

  /* ── create / edit ── */

  const openCreate = () => {
    setEditingDoctor(null);
    setFormName(''); setFormEmail(''); setFormPassword(''); setFormSpecialization(''); setFormError('');
    setShowForm(true);
  };

  const openEdit = (doctor: DoctorListItem) => {
    setEditingDoctor(doctor);
    setFormName(doctor.name); setFormEmail(doctor.email); setFormPassword('');
    setFormSpecialization(doctor.specialization); setFormError('');
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditingDoctor(null); };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSubmitting(true);
    try {
      if (editingDoctor) {
        await api.patch(`/doctors/${editingDoctor.id}`, { name: formName, email: formEmail, specialization: formSpecialization });
      } else {
        if (!formPassword) { setFormError('Password is required for new doctor'); setFormSubmitting(false); return; }
        await api.post('/doctors', { name: formName, email: formEmail, password: formPassword, specialization: formSpecialization });
      }
      closeForm();
      await fetchDoctors();
      if (showDetail && selectedDoctor && editingDoctor?.id === selectedDoctor.id) {
        openDetail(selectedDoctor.id);
      }
    } catch (err: any) {
      setFormError(err?.response?.data?.message || 'Something went wrong');
    } finally { setFormSubmitting(false); }
  };

  /* ── suspend / restore ── */

  const handleSuspend = async (doctorId: number) => {
    if (!confirm('Suspend this doctor? Their ward assignments, patient assignments, and scheduled appointments will be cancelled.')) return;
    try {
      await api.delete(`/doctors/${doctorId}`);
      await fetchDoctors();
      if (showDetail && selectedDoctor?.id === doctorId) openDetail(doctorId);
    } catch (err: any) { alert(err?.response?.data?.message || 'Failed to suspend doctor'); }
  };

  const handleRestore = async (doctorId: number) => {
    try {
      await api.patch(`/doctors/${doctorId}/restore`);
      await fetchDoctors();
      if (showDetail && selectedDoctor?.id === doctorId) openDetail(doctorId);
    } catch (err: any) { alert(err?.response?.data?.message || 'Failed to restore doctor'); }
  };

  /* ── ward assignment ── */

  const openWardAssign = async (doctorId: number) => {
    setAssignDoctorId(doctorId);
    setSelectedWardId('');
    setAssignError('');
    try {
      const res = await api.get('/wards');
      setAllWards((res.data.wards || []).filter((w: any) => w.active !== false));
    } catch { setAllWards([]); }
    setShowAssignWard(true);
  };

  const handleAssignWard = async () => {
    if (!assignDoctorId || !selectedWardId) return;
    setAssignError('');
    try {
      await api.post(`/doctors/${assignDoctorId}/wards`, { ward_id: selectedWardId });
      setShowAssignWard(false);
      await fetchDoctors();
      if (showDetail && selectedDoctor?.id === assignDoctorId) openDetail(assignDoctorId);
    } catch (err: any) { setAssignError(err?.response?.data?.message || 'Failed to assign ward'); }
  };

  const handleUnassignWard = async (doctorId: number, wardId: number) => {
    try {
      await api.delete(`/doctors/${doctorId}/wards/${wardId}`);
      await fetchDoctors();
      if (showDetail && selectedDoctor?.id === doctorId) openDetail(doctorId);
    } catch (err: any) { alert(err?.response?.data?.message || 'Failed to unassign ward'); }
  };

  const filteredDoctors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return doctors;

    return doctors.filter((doctor) => {
      const targets =
        searchField === 'name'
          ? [doctor.name]
          : searchField === 'email'
            ? [doctor.email]
            : searchField === 'specialization'
              ? [doctor.specialization]
              : [doctor.name, doctor.email, doctor.specialization];

      return targets.some((value) => value.toLowerCase().includes(q));
    });
  }, [doctors, searchField, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredDoctors.length / PAGE_SIZE));
  const paginatedDoctors = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredDoctors.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredDoctors]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchField, searchQuery]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  /* ── loading ── */

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  /* ── render ── */

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          <Stethoscope className="h-8 w-8 text-primary-600 mr-3" />
          <h1 className="text-3xl font-bold text-slate-100">Doctors</h1>
        </div>
        {isAdmin && (
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Doctor
          </button>
        )}
      </div>

      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative md:col-span-2">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            className="input-field w-full pl-9"
            placeholder="Search doctors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select className="input-field w-full" value={searchField} onChange={(e) => setSearchField(e.target.value)}>
          <option value="all">Search: All fields</option>
          <option value="name">Search: Name</option>
          <option value="email">Search: Email</option>
          <option value="specialization">Search: Specialization</option>
        </select>
      </div>

      {/* Cards grid */}
      {filteredDoctors.length === 0 ? (
        <div className="card text-center py-12">
          <Stethoscope className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-slate-300">{doctors.length === 0 ? 'No doctors found' : 'No doctors match your search'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedDoctors.map((doctor) => (
            <div key={doctor.id} className={`card hover:shadow-lg transition-shadow ${doctor.active === false ? 'opacity-60' : ''}`}>
              <button type="button" onClick={() => openDetail(doctor.id)} className="text-left w-full">
                <div className="flex items-start justify-between mb-4">
                  <div className="min-w-0">
                    <h3 className="text-xl font-semibold text-slate-100 truncate">{doctor.name}</h3>
                    <p className="text-sm text-slate-300 truncate">{doctor.email}</p>
                  </div>
                  <div className={`p-2 rounded-full border ${doctor.active === false ? 'bg-red-500/15 border-red-500/25' : 'bg-purple-500/15 border-purple-500/25'}`}>
                    <Stethoscope className={`h-6 w-6 ${doctor.active === false ? 'text-red-300' : 'text-purple-300'}`} />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="inline-block px-3 py-1 bg-purple-500/15 text-purple-200 border border-purple-500/30 rounded-full text-sm font-medium">
                    {doctor.specialization}
                  </span>
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-teal-500/15 text-teal-200 border border-teal-500/30 rounded-full text-sm font-medium">
                    <Building2 className="h-3.5 w-3.5" />
                    {Number(doctor.ward_count)} ward{Number(doctor.ward_count) !== 1 ? 's' : ''}
                  </span>
                  {doctor.active === false && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-500/15 text-red-200 border border-red-500/30 rounded-full text-sm font-medium">
                      <Ban className="h-3.5 w-3.5" /> Suspended
                    </span>
                  )}
                </div>
              </button>

              {/* Admin actions */}
              {isAdmin && (
                <div className="flex gap-2 mt-4 pt-3 border-t border-slate-800">
                  <button onClick={() => openEdit(doctor)} className="flex items-center gap-1 text-sm text-slate-300 hover:text-blue-300 transition-colors" title="Edit">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  {doctor.active !== false && (
                    <button onClick={() => openWardAssign(doctor.id)} className="flex items-center gap-1 text-sm text-slate-300 hover:text-teal-300 transition-colors" title="Assign Ward">
                      <Building2 className="h-3.5 w-3.5" /> Assign Ward
                    </button>
                  )}
                  {doctor.active === false ? (
                    <button onClick={() => handleRestore(doctor.id)} className="flex items-center gap-1 text-sm text-slate-300 hover:text-green-300 transition-colors ml-auto" title="Restore">
                      <RotateCcw className="h-3.5 w-3.5" /> Restore
                    </button>
                  ) : (
                    <button onClick={() => handleSuspend(doctor.id)} className="flex items-center gap-1 text-sm text-slate-300 hover:text-red-300 transition-colors ml-auto" title="Suspend">
                      <Ban className="h-3.5 w-3.5" /> Suspend
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {filteredDoctors.length > 0 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-slate-400">
            Page {currentPage} of {totalPages} ({filteredDoctors.length} result{filteredDoctors.length !== 1 ? 's' : ''})
          </p>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
              Previous
            </button>
            <button className="btn-secondary" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
              Next
            </button>
          </div>
        </div>
      )}

      {/* ── Detail modal ── */}
      {showDetail && (
        <Modal title="Doctor Details" onClose={closeDetail} wide>
          {loadingDetail ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
            </div>
          ) : selectedDoctor ? (
            <div className="space-y-6">
              {/* Basic info */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">{selectedDoctor.name}</h3>
                  <p className="text-sm text-slate-400">{selectedDoctor.email}</p>
                  <p className="text-xs text-slate-500 mt-1">Joined {new Date(selectedDoctor.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block px-3 py-1 bg-purple-500/15 text-purple-200 border border-purple-500/30 rounded-full text-sm font-medium">
                    {selectedDoctor.specialization}
                  </span>
                  {selectedDoctor.active === false && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-500/15 text-red-200 border border-red-500/30 rounded-full text-sm font-medium">
                      <Ban className="h-3.5 w-3.5" /> Suspended
                    </span>
                  )}
                </div>
              </div>

              {/* Stats badges */}
              <div className="flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-500/15 text-teal-200 border border-teal-500/30 rounded-full text-sm font-medium">
                  <Building2 className="h-4 w-4" />
                  {selectedDoctor.stats.ward_count} ward{selectedDoctor.stats.ward_count !== 1 ? 's' : ''}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/15 text-blue-200 border border-blue-500/30 rounded-full text-sm font-medium">
                  <Users className="h-4 w-4" />
                  {selectedDoctor.stats.patient_count} patient{selectedDoctor.stats.patient_count !== 1 ? 's' : ''}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 text-amber-200 border border-amber-500/30 rounded-full text-sm font-medium">
                  <CalendarCheck className="h-4 w-4" />
                  {Number(selectedDoctor.appointment_stats.total)} appointment{Number(selectedDoctor.appointment_stats.total) !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Assigned wards with unassign */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Assigned Wards</h4>
                  {isAdmin && selectedDoctor.active !== false && (
                    <button onClick={() => openWardAssign(selectedDoctor.id)} className="text-xs text-teal-400 hover:text-teal-300">+ Assign Ward</button>
                  )}
                </div>
                {selectedDoctor.wards.length === 0 ? (
                  <p className="text-slate-500 text-sm">No wards assigned</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selectedDoctor.wards.map((ward) => (
                      <span key={ward.id} className="inline-flex items-center gap-1 px-3 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200">
                        <Building2 className="h-3.5 w-3.5 text-teal-400" />
                        {ward.name}
                        {isAdmin && (
                          <button
                            onClick={() => handleUnassignWard(selectedDoctor.id, ward.id)}
                            className="ml-1 p-0.5 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-300"
                            title="Remove from ward"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Assigned patients */}
              <div>
                <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-2">Patients (via wards)</h4>
                {selectedDoctor.assigned_patients.length === 0 ? (
                  <p className="text-slate-500 text-sm">No patients in assigned wards</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700/50">
                          <th className="text-left py-2 px-3 font-semibold text-slate-300">Name</th>
                          <th className="text-left py-2 px-3 font-semibold text-slate-300">Email</th>
                          <th className="text-left py-2 px-3 font-semibold text-slate-300">Ward</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedDoctor.assigned_patients.map((patient) => (
                          <tr key={patient.user_id} className="border-b border-slate-800/50 hover:bg-slate-800/40">
                            <td className="py-2 px-3 text-slate-100">{patient.name}</td>
                            <td className="py-2 px-3 text-slate-400">{patient.email}</td>
                            <td className="py-2 px-3 text-slate-400">{patient.ward_name ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-slate-400 text-center py-8">Failed to load doctor details.</p>
          )}
        </Modal>
      )}

      {/* ── Create / Edit modal ── */}
      {showForm && (
        <Modal title={editingDoctor ? 'Edit Doctor' : 'Add Doctor'} onClose={closeForm}>
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
              <input type="text" className="input-field w-full" required value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Full name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
              <input type="email" className="input-field w-full" required value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="doctor@example.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Specialization</label>
              <input type="text" className="input-field w-full" required value={formSpecialization} onChange={(e) => setFormSpecialization(e.target.value)} placeholder="e.g. Cardiology" />
            </div>
            {!editingDoctor && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
                <input type="password" className="input-field w-full" required value={formPassword} onChange={(e) => setFormPassword(e.target.value)} placeholder="••••••••" />
              </div>
            )}
            {formError && <p className="text-red-400 text-sm">{formError}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={closeForm} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={formSubmitting} className="btn-primary">
                {formSubmitting ? 'Saving…' : editingDoctor ? 'Save Changes' : 'Create Doctor'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Assign Ward modal ── */}
      {showAssignWard && (
        <Modal title="Assign Doctor to Ward" onClose={() => setShowAssignWard(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Ward</label>
              <select className="input-field w-full" value={selectedWardId} onChange={(e) => setSelectedWardId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">Select a ward…</option>
                {allWards.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            {assignError && <p className="text-red-400 text-sm">{assignError}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowAssignWard(false)} className="btn-secondary">Cancel</button>
              <button type="button" onClick={handleAssignWard} disabled={!selectedWardId} className="btn-primary">Assign</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default DoctorsPage;
