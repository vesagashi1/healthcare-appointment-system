import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Building2, Plus, X, Search } from 'lucide-react';

interface WardListItem {
  id: number;
  name: string;
  active: boolean;
  patient_count: number | string;
  doctor_count: number | string;
  nurse_count: number | string;
}

interface WardPatient {
  id: number;
  user_id: number;
  name: string;
  email?: string;
}

interface WardDoctor {
  id: number;
  specialization: string;
  user_id: number;
  name: string;
  email?: string;
}

interface WardNurse {
  user_id: number;
  name: string;
  email?: string;
}

interface WardDetail {
  id: number;
  name: string;
  active: boolean;
  stats: {
    patient_count: number;
    doctor_count: number;
    nurse_count: number;
  };
  patients: WardPatient[];
  doctors: WardDoctor[];
  nurses: WardNurse[];
}

interface DoctorOption {
  id: number;
  specialization: string;
  user_id: number;
  name: string;
  email: string;
}

interface NurseOption {
  user_id: number;
  name: string;
  email: string;
}

function Modal(props: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-slate-950 text-slate-100 w-full max-w-2xl rounded-lg shadow-lg overflow-hidden border border-slate-800">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold">{props.title}</h2>
          <button
            type="button"
            onClick={props.onClose}
            className="p-2 rounded hover:bg-slate-900"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-slate-300" />
          </button>
        </div>
        <div className="px-6 py-4">{props.children}</div>
      </div>
    </div>
  );
}

const WardsPage = () => {
  const PAGE_SIZE = 9;
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [wards, setWards] = useState<WardListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchField, setSearchField] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedWardId, setSelectedWardId] = useState<number | null>(null);
  const [selectedWard, setSelectedWard] = useState<WardDetail | null>(null);
  const [loadingWard, setLoadingWard] = useState(false);

  const [showDetails, setShowDetails] = useState(false);
  const [showCreateEdit, setShowCreateEdit] = useState(false);
  const [editingWard, setEditingWard] = useState<WardListItem | null>(null);
  const [wardName, setWardName] = useState('');

  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [deactivatingWard, setDeactivatingWard] = useState<WardListItem | null>(null);

  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [nurses, setNurses] = useState<NurseOption[]>([]);

  const [selectedDoctorToAdd, setSelectedDoctorToAdd] = useState<string>('');
  const [selectedNurseToAdd, setSelectedNurseToAdd] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const fetchWards = async () => {
    setLoading(true);
    try {
      const response = await api.get('/wards');
      setWards(response.data.wards || []);
    } catch (error) {
      console.error('Error fetching wards:', error);
      setWards([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchWardDetails = async (wardId: number) => {
    setLoadingWard(true);
    try {
      const response = await api.get(`/wards/${wardId}`);
      setSelectedWard(response.data.ward || null);
    } catch (error) {
      console.error('Error fetching ward details:', error);
      setSelectedWard(null);
    } finally {
      setLoadingWard(false);
    }
  };

  const fetchStaffOptions = async () => {
    try {
      const [doctorsResponse, nursesResponse] = await Promise.all([
        api.get('/doctors'),
        api.get('/nurses'),
      ]);
      setDoctors(doctorsResponse.data.doctors || []);
      setNurses(nursesResponse.data.nurses || []);
    } catch (error) {
      console.error('Error fetching staff options:', error);
      setDoctors([]);
      setNurses([]);
    }
  };

  useEffect(() => {
    fetchWards();
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    fetchStaffOptions();
  }, [isAdmin]);

  const wardDoctorIds = useMemo(() => {
    const ids = new Set<number>();
    (selectedWard?.doctors || []).forEach((d) => ids.add(d.id));
    return ids;
  }, [selectedWard]);

  const wardNurseIds = useMemo(() => {
    const ids = new Set<number>();
    (selectedWard?.nurses || []).forEach((n) => ids.add(n.user_id));
    return ids;
  }, [selectedWard]);

  const unassignedDoctors = useMemo(
    () => doctors.filter((d) => !wardDoctorIds.has(d.id)),
    [doctors, wardDoctorIds]
  );

  const unassignedNurses = useMemo(
    () => nurses.filter((n) => !wardNurseIds.has(n.user_id)),
    [nurses, wardNurseIds]
  );

  const openDetails = async (ward: WardListItem) => {
    setSelectedWardId(ward.id);
    setSelectedWard(null);
    setSelectedDoctorToAdd('');
    setSelectedNurseToAdd('');
    setShowDetails(true);
    await fetchWardDetails(ward.id);
  };

  const openCreate = () => {
    setEditingWard(null);
    setWardName('');
    setShowCreateEdit(true);
  };

  const openEdit = (ward: WardListItem) => {
    setEditingWard(ward);
    setWardName(ward.name);
    setShowCreateEdit(true);
  };

  const openDeactivate = (ward: WardListItem) => {
    setDeactivatingWard(ward);
    setShowDeactivateConfirm(true);
  };

  const saveWard = async () => {
    const trimmed = wardName.trim();
    if (!trimmed) return;

    setSaving(true);
    try {
      if (editingWard) {
        await api.patch(`/wards/${editingWard.id}`, { name: trimmed });
      } else {
        await api.post('/wards', { name: trimmed });
      }
      setShowCreateEdit(false);
      await fetchWards();
    } catch (error) {
      console.error('Error saving ward:', error);
    } finally {
      setSaving(false);
    }
  };

  const deactivateWard = async () => {
    if (!deactivatingWard) return;

    setSaving(true);
    try {
      await api.delete(`/wards/${deactivatingWard.id}`);
      setShowDeactivateConfirm(false);
      setDeactivatingWard(null);
      if (selectedWardId === deactivatingWard.id) {
        setShowDetails(false);
        setSelectedWardId(null);
        setSelectedWard(null);
      }
      await fetchWards();
    } catch (error) {
      console.error('Error deactivating ward:', error);
    } finally {
      setSaving(false);
    }
  };

  const restoreWard = async (ward: WardListItem) => {
    if (!isAdmin) return;
    setSaving(true);
    try {
      await api.patch(`/wards/${ward.id}/restore`);
      if (selectedWardId === ward.id) {
        await fetchWardDetails(ward.id);
      }
      await fetchWards();
    } catch (error) {
      console.error('Error restoring ward:', error);
    } finally {
      setSaving(false);
    }
  };

  const addDoctorToWard = async () => {
    if (!isAdmin || !selectedWardId || !selectedDoctorToAdd) return;

    setSaving(true);
    try {
      await api.post(`/wards/${selectedWardId}/doctors`, {
        doctor_id: Number(selectedDoctorToAdd),
      });
      setSelectedDoctorToAdd('');
      await fetchWardDetails(selectedWardId);
      await fetchWards();
    } catch (error) {
      console.error('Error assigning doctor:', error);
    } finally {
      setSaving(false);
    }
  };

  const removeDoctorFromWard = async (doctorId: number) => {
    if (!isAdmin || !selectedWardId) return;

    setSaving(true);
    try {
      await api.delete(`/wards/${selectedWardId}/doctors/${doctorId}`);
      await fetchWardDetails(selectedWardId);
      await fetchWards();
    } catch (error) {
      console.error('Error removing doctor:', error);
    } finally {
      setSaving(false);
    }
  };

  const addNurseToWard = async () => {
    if (!isAdmin || !selectedWardId || !selectedNurseToAdd) return;

    setSaving(true);
    try {
      await api.post(`/wards/${selectedWardId}/nurses`, {
        nurse_id: Number(selectedNurseToAdd),
      });
      setSelectedNurseToAdd('');
      await fetchWardDetails(selectedWardId);
      await fetchWards();
    } catch (error) {
      console.error('Error assigning nurse:', error);
    } finally {
      setSaving(false);
    }
  };

  const removeNurseFromWard = async (nurseId: number) => {
    if (!isAdmin || !selectedWardId) return;

    setSaving(true);
    try {
      await api.delete(`/wards/${selectedWardId}/nurses/${nurseId}`);
      await fetchWardDetails(selectedWardId);
      await fetchWards();
    } catch (error) {
      console.error('Error removing nurse:', error);
    } finally {
      setSaving(false);
    }
  };

  const filteredWards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return wards;

    return wards.filter((ward) => {
      const targets =
        searchField === 'name'
          ? [ward.name]
          : searchField === 'patient_count'
            ? [String(ward.patient_count)]
            : searchField === 'doctor_count'
              ? [String(ward.doctor_count)]
              : searchField === 'nurse_count'
                ? [String(ward.nurse_count)]
                : [ward.name, String(ward.patient_count), String(ward.doctor_count), String(ward.nurse_count)];

      return targets.some((value) => value.toLowerCase().includes(q));
    });
  }, [searchField, searchQuery, wards]);

  const totalPages = Math.max(1, Math.ceil(filteredWards.length / PAGE_SIZE));
  const paginatedWards = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredWards.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredWards]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchField, searchQuery]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          <Building2 className="h-8 w-8 text-primary-400 mr-3" />
          <h1 className="text-3xl font-bold text-slate-100">Wards</h1>
        </div>
        {isAdmin && (
          <button type="button" className="btn-primary flex items-center gap-2" onClick={openCreate}>
            <Plus className="h-5 w-5" />
            Create Ward
          </button>
        )}
      </div>

      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative md:col-span-2">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            className="input-field w-full pl-9"
            placeholder="Search wards..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select className="input-field w-full" value={searchField} onChange={(e) => setSearchField(e.target.value)}>
          <option value="all">Search: All fields</option>
          <option value="name">Search: Ward Name</option>
          <option value="patient_count">Search: Patient Count</option>
          <option value="doctor_count">Search: Doctor Count</option>
          <option value="nurse_count">Search: Nurse Count</option>
        </select>
      </div>

      {filteredWards.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 text-center py-12">
          <Building2 className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-300">{wards.length === 0 ? 'No wards found' : 'No wards match your search'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedWards.map((ward) => (
            <div
              key={ward.id}
              className="rounded-lg border border-slate-800 bg-slate-950/60 p-6 hover:bg-slate-950/80 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-semibold text-slate-100">{ward.name}</h3>
                    {!ward.active && (
                      <span className="text-xs px-2 py-0.5 rounded-full border border-slate-700 text-slate-300">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400">Ward #{ward.id}</p>
                </div>
                <div className="bg-primary-600/20 p-2 rounded-full border border-primary-600/30">
                  <Building2 className="h-6 w-6 text-primary-300" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-sm mb-4">
                <div className="text-center">
                  <div className="text-slate-400">Patients</div>
                  <div className="font-semibold text-slate-100">{Number(ward.patient_count) || 0}</div>
                </div>
                <div className="text-center">
                  <div className="text-slate-400">Doctors</div>
                  <div className="font-semibold text-slate-100">{Number(ward.doctor_count) || 0}</div>
                </div>
                <div className="text-center">
                  <div className="text-slate-400">Nurses</div>
                  <div className="font-semibold text-slate-100">{Number(ward.nurse_count) || 0}</div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-lg px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium transition-colors"
                  onClick={() => openDetails(ward)}
                >
                  View Details
                </button>
                {isAdmin && (
                  <>
                    {ward.active ? (
                      <>
                        <button
                          type="button"
                          className="rounded-lg px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium transition-colors"
                          onClick={() => openEdit(ward)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="rounded-lg px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium transition-colors"
                          onClick={() => openDeactivate(ward)}
                        >
                          Deactivate
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="rounded-lg px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium transition-colors"
                        onClick={() => restoreWard(ward)}
                        disabled={saving}
                      >
                        Restore
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredWards.length > 0 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-slate-400">
            Page {currentPage} of {totalPages} ({filteredWards.length} result{filteredWards.length !== 1 ? 's' : ''})
          </p>
          <div className="flex gap-2">
            <button
              className="btn-secondary"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <button
              className="btn-secondary"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {showDetails && (
        <Modal
          title={selectedWard ? `Ward: ${selectedWard.name}` : 'Ward Details'}
          onClose={() => {
            setShowDetails(false);
            setSelectedWardId(null);
            setSelectedWard(null);
          }}
        >
          {loadingWard || !selectedWard ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {!selectedWard.active && (
                <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                  <div className="text-sm text-slate-300">
                    Status: <span className="font-semibold">Inactive</span>
                  </div>
                  {isAdmin && selectedWardId && (
                    <button
                      type="button"
                      className="rounded-lg px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium transition-colors"
                      onClick={() => {
                        const current = wards.find((w) => w.id === selectedWardId);
                        if (current) void restoreWard(current);
                      }}
                      disabled={saving}
                    >
                      Restore
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="text-center bg-slate-950/40 border border-slate-800 rounded p-3">
                  <div className="text-slate-400">Patients</div>
                  <div className="font-semibold text-slate-100">{selectedWard.stats.patient_count}</div>
                </div>
                <div className="text-center bg-slate-950/40 border border-slate-800 rounded p-3">
                  <div className="text-slate-400">Doctors</div>
                  <div className="font-semibold text-slate-100">{selectedWard.stats.doctor_count}</div>
                </div>
                <div className="text-center bg-slate-950/40 border border-slate-800 rounded p-3">
                  <div className="text-slate-400">Nurses</div>
                  <div className="font-semibold text-slate-100">{selectedWard.stats.nurse_count}</div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-100 mb-2">Doctors</h3>
                {selectedWard.doctors.length === 0 ? (
                  <div className="text-sm text-slate-300">No doctors assigned</div>
                ) : (
                  <div className="space-y-2">
                    {selectedWard.doctors.map((d) => (
                      <div key={d.id} className="flex items-center justify-between bg-slate-950/40 border border-slate-800 rounded p-3">
                        <div>
                          <div className="font-medium text-slate-100">{d.name}</div>
                          <div className="text-sm text-slate-300">{d.specialization}</div>
                          {d.email && <div className="text-sm text-slate-300">{d.email}</div>}
                        </div>
                        {isAdmin && (
                          <button
                            type="button"
                            className="rounded-lg px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium transition-colors"
                            onClick={() => removeDoctorFromWard(d.id)}
                            disabled={saving}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {isAdmin && (
                  <div className="mt-3 flex gap-2">
                    <select
                      className="input-field bg-slate-900 text-slate-100 border-slate-700"
                      value={selectedDoctorToAdd}
                      onChange={(e) => setSelectedDoctorToAdd(e.target.value)}
                    >
                      <option value="">Select a doctor to add</option>
                      {unassignedDoctors.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.specialization})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={addDoctorToWard}
                      disabled={saving || !selectedDoctorToAdd}
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-100 mb-2">Nurses</h3>
                {selectedWard.nurses.length === 0 ? (
                  <div className="text-sm text-slate-300">No nurses assigned</div>
                ) : (
                  <div className="space-y-2">
                    {selectedWard.nurses.map((n) => (
                      <div key={n.user_id} className="flex items-center justify-between bg-slate-950/40 border border-slate-800 rounded p-3">
                        <div>
                          <div className="font-medium text-slate-100">{n.name}</div>
                          {n.email && <div className="text-sm text-slate-300">{n.email}</div>}
                        </div>
                        {isAdmin && (
                          <button
                            type="button"
                            className="rounded-lg px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium transition-colors"
                            onClick={() => removeNurseFromWard(n.user_id)}
                            disabled={saving}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {isAdmin && (
                  <div className="mt-3 flex gap-2">
                    <select
                      className="input-field bg-slate-900 text-slate-100 border-slate-700"
                      value={selectedNurseToAdd}
                      onChange={(e) => setSelectedNurseToAdd(e.target.value)}
                    >
                      <option value="">Select a nurse to add</option>
                      {unassignedNurses.map((n) => (
                        <option key={n.user_id} value={n.user_id}>
                          {n.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={addNurseToWard}
                      disabled={saving || !selectedNurseToAdd}
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-100 mb-2">Patients</h3>
                {selectedWard.patients.length === 0 ? (
                  <div className="text-sm text-slate-300">
                    {user?.role === 'patient' || user?.role === 'caregiver'
                      ? 'Patient list is restricted for your role'
                      : 'No patients assigned'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedWard.patients.map((p) => (
                      <div key={p.id} className="bg-slate-950/40 border border-slate-800 rounded p-3">
                        <div className="font-medium text-slate-100">{p.name}</div>
                        {p.email && <div className="text-sm text-slate-300">{p.email}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {isAdmin && selectedWardId && (
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    className="rounded-lg px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium transition-colors"
                    onClick={() => {
                      const current = wards.find((w) => w.id === selectedWardId);
                      if (current) openEdit(current);
                    }}
                    disabled={saving || !selectedWard.active}
                  >
                    Edit Ward
                  </button>
                  <button
                    type="button"
                    className="rounded-lg px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium transition-colors"
                    onClick={() => {
                      const current = wards.find((w) => w.id === selectedWardId);
                      if (current) openDeactivate(current);
                    }}
                    disabled={saving || !selectedWard.active}
                  >
                    Deactivate Ward
                  </button>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}

      {showCreateEdit && (
        <Modal
          title={editingWard ? 'Edit Ward' : 'Create Ward'}
          onClose={() => {
            if (saving) return;
            setShowCreateEdit(false);
          }}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Ward Name</label>
              <input
                className="input-field bg-slate-900 text-slate-100 border-slate-700"
                value={wardName}
                onChange={(e) => setWardName(e.target.value)}
                placeholder="e.g. Cardiology"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium transition-colors"
                onClick={() => setShowCreateEdit(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={saveWard}
                disabled={saving || !wardName.trim()}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showDeactivateConfirm && deactivatingWard && (
        <Modal
          title="Deactivate Ward"
          onClose={() => {
            if (saving) return;
            setShowDeactivateConfirm(false);
            setDeactivatingWard(null);
          }}
        >
          <div className="space-y-4">
            <p className="text-slate-200">
              Deactivating <strong>{deactivatingWard.name}</strong> will unassign all patients in the ward and
              remove doctor/nurse ward links.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium transition-colors"
                onClick={() => {
                  setShowDeactivateConfirm(false);
                  setDeactivatingWard(null);
                }}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={deactivateWard}
                disabled={saving}
              >
                {saving ? 'Deactivating...' : 'Deactivate'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default WardsPage;
