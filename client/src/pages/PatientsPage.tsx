import { useEffect, useState } from "react";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import {
  Users,
  X,
  User,
  Plus,
  Pencil,
  Ban,
  RotateCcw,
  Building2,
  CalendarCheck,
  FileText,
  Heart,
} from "lucide-react";

/* ───── types ───── */

interface PatientListItem {
  id: number;
  user_id: number;
  name: string;
  email: string;
  date_of_birth?: string;
  gender?: string;
  blood_type?: string;
  ward_id?: number;
  ward_name?: string;
  created_at: string;
  active: boolean;
}

interface StaffAssignment {
  id: number;
  role: string;
  staff_user_id: number;
  staff_name: string;
  staff_email: string;
}
interface CaregiverLink {
  id: number;
  relationship: string;
  caregiver_user_id: number;
  caregiver_name: string;
  caregiver_email: string;
  created_at: string;
}

interface PatientDetail {
  id: number;
  user_id: number;
  name: string;
  email: string;
  date_of_birth?: string;
  gender?: string;
  blood_type?: string;
  ward_id?: number;
  ward_name?: string;
  created_at: string;
  active: boolean;
  assigned_staff: StaffAssignment[];
  caregivers: CaregiverLink[];
  appointment_stats: {
    total: string;
    scheduled: string;
    approved: string;
    completed: string;
  };
  stats: { staff_count: number; caregiver_count: number; record_count: number };
}

interface WardOption {
  id: number;
  name: string;
}

/* ───── modal ───── */

function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div
        className={`bg-slate-950 text-slate-100 w-full ${wide ? "max-w-3xl" : "max-w-lg"} rounded-lg shadow-lg overflow-hidden border border-slate-800 max-h-[90vh] flex flex-col`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded hover:bg-slate-900"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-slate-300" />
          </button>
        </div>
        <div className="px-6 py-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

/* ───── page ───── */

const PatientsPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  /* ── list ── */
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [loading, setLoading] = useState(true);

  /* ── detail ── */
  const [selectedPatient, setSelectedPatient] = useState<PatientDetail | null>(
    null,
  );
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  /* ── create / edit ── */
  const [showForm, setShowForm] = useState(false);
  const [editingPatient, setEditingPatient] = useState<PatientListItem | null>(
    null,
  );
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formDob, setFormDob] = useState("");
  const [formGender, setFormGender] = useState("");
  const [formBloodType, setFormBloodType] = useState("");
  const [formWardId, setFormWardId] = useState<number | "">("");
  const [formError, setFormError] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);

  /* ── ward options ── */
  const [allWards, setAllWards] = useState<WardOption[]>([]);

  useEffect(() => {
    fetchPatients();
  }, []);

  /* ── data fetching ── */

  const fetchPatients = async () => {
    try {
      const res = await api.get("/patients");
      setPatients(res.data.patients || []);
    } catch (err) {
      console.error("Error fetching patients:", err);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (patientId: number) => {
    setShowDetail(true);
    setSelectedPatient(null);
    setLoadingDetail(true);
    try {
      const res = await api.get(`/patients/${patientId}`);
      setSelectedPatient(res.data.patient || null);
    } catch (err) {
      console.error("Error fetching patient details:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetail = () => {
    setShowDetail(false);
    setSelectedPatient(null);
  };

  /* ── create / edit ── */

  const loadWards = async () => {
    try {
      const res = await api.get("/wards");
      setAllWards(
        (res.data.wards || []).filter((w: any) => w.active !== false),
      );
    } catch {
      setAllWards([]);
    }
  };

  const openCreate = async () => {
    setEditingPatient(null);
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setFormDob("");
    setFormGender("");
    setFormBloodType("");
    setFormWardId("");
    setFormError("");
    await loadWards();
    setShowForm(true);
  };

  const openEdit = async (patient: PatientListItem) => {
    setEditingPatient(patient);
    setFormName(patient.name);
    setFormEmail(patient.email);
    setFormPassword("");
    setFormDob(
      patient.date_of_birth ? patient.date_of_birth.split("T")[0] : "",
    );
    setFormGender(patient.gender || "");
    setFormBloodType(patient.blood_type || "");
    setFormWardId(patient.ward_id || "");
    setFormError("");
    await loadWards();
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingPatient(null);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSubmitting(true);
    try {
      const payload: any = {
        name: formName,
        email: formEmail,
        date_of_birth: formDob || null,
        gender: formGender || null,
        blood_type: formBloodType || null,
        ward_id: formWardId || null,
      };

      if (editingPatient) {
        await api.patch(`/patients/${editingPatient.id}`, payload);
      } else {
        if (!formPassword) {
          setFormError("Password is required for new patient");
          setFormSubmitting(false);
          return;
        }
        payload.password = formPassword;
        await api.post("/patients", payload);
      }
      closeForm();
      await fetchPatients();
      if (
        showDetail &&
        selectedPatient &&
        editingPatient?.id === selectedPatient.id
      ) {
        openDetail(selectedPatient.id);
      }
    } catch (err: any) {
      setFormError(err?.response?.data?.message || "Something went wrong");
    } finally {
      setFormSubmitting(false);
    }
  };

  /* ── suspend / restore ── */

  const handleSuspend = async (patientId: number) => {
    if (
      !confirm(
        "Suspend this patient? Their staff assignments, caregiver links, and pending appointments will be cancelled.",
      )
    )
      return;
    try {
      await api.delete(`/patients/${patientId}`);
      await fetchPatients();
      if (showDetail && selectedPatient?.id === patientId)
        openDetail(patientId);
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to suspend patient");
    }
  };

  const handleRestore = async (patientId: number) => {
    try {
      await api.patch(`/patients/${patientId}/restore`);
      await fetchPatients();
      if (showDetail && selectedPatient?.id === patientId)
        openDetail(patientId);
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to restore patient");
    }
  };

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
          <Users className="h-8 w-8 text-primary-600 mr-3" />
          <h1 className="text-3xl font-bold text-slate-100">Patients</h1>
        </div>
        {isAdmin && (
          <button
            onClick={openCreate}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Add Patient
          </button>
        )}
      </div>

      {/* Cards grid */}
      {patients.length === 0 ? (
        <div className="card text-center py-12">
          <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-slate-300">No patients found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {patients.map((patient) => (
            <div
              key={patient.id}
              className={`card hover:shadow-lg transition-shadow ${patient.active === false ? "opacity-60" : ""}`}
            >
              <button
                type="button"
                onClick={() => openDetail(patient.id)}
                className="text-left w-full"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="min-w-0">
                    <h3 className="text-xl font-semibold text-slate-100 truncate">
                      {patient.name}
                    </h3>
                    <p className="text-sm text-slate-300 truncate">
                      {patient.email}
                    </p>
                  </div>
                  <div
                    className={`p-2 rounded-full border ${patient.active === false ? "bg-red-500/15 border-red-500/25" : "bg-primary-500/15 border-primary-500/25"}`}
                  >
                    <User
                      className={`h-6 w-6 ${patient.active === false ? "text-red-300" : "text-primary-600"}`}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {patient.blood_type && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-rose-500/15 text-rose-200 border border-rose-500/30 rounded-full text-sm font-medium">
                      <Heart className="h-3.5 w-3.5" />
                      {patient.blood_type}
                    </span>
                  )}
                  {patient.gender && (
                    <span className="inline-block px-3 py-1 bg-purple-500/15 text-purple-200 border border-purple-500/30 rounded-full text-sm font-medium capitalize">
                      {patient.gender}
                    </span>
                  )}
                  {patient.ward_name && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-teal-500/15 text-teal-200 border border-teal-500/30 rounded-full text-sm font-medium">
                      <Building2 className="h-3.5 w-3.5" />
                      {patient.ward_name}
                    </span>
                  )}
                  {patient.active === false && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-500/15 text-red-200 border border-red-500/30 rounded-full text-sm font-medium">
                      <Ban className="h-3.5 w-3.5" /> Suspended
                    </span>
                  )}
                </div>
              </button>

              {/* Admin actions */}
              {isAdmin && (
                <div className="flex gap-2 mt-4 pt-3 border-t border-slate-800">
                  <button
                    onClick={() => openEdit(patient)}
                    className="flex items-center gap-1 text-sm text-slate-300 hover:text-blue-300 transition-colors"
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  {patient.active === false ? (
                    <button
                      onClick={() => handleRestore(patient.id)}
                      className="flex items-center gap-1 text-sm text-slate-300 hover:text-green-300 transition-colors ml-auto"
                      title="Restore"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Restore
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSuspend(patient.id)}
                      className="flex items-center gap-1 text-sm text-slate-300 hover:text-red-300 transition-colors ml-auto"
                      title="Suspend"
                    >
                      <Ban className="h-3.5 w-3.5" /> Suspend
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Detail modal ── */}
      {showDetail && (
        <Modal title="Patient Details" onClose={closeDetail} wide>
          {loadingDetail ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
            </div>
          ) : selectedPatient ? (
            <div className="space-y-6">
              {/* Basic info */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">
                    {selectedPatient.name}
                  </h3>
                  <p className="text-sm text-slate-400">
                    {selectedPatient.email}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Joined{" "}
                    {new Date(selectedPatient.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedPatient.blood_type && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-rose-500/15 text-rose-200 border border-rose-500/30 rounded-full text-sm font-medium">
                      <Heart className="h-3.5 w-3.5" />
                      {selectedPatient.blood_type}
                    </span>
                  )}
                  {selectedPatient.active === false && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-500/15 text-red-200 border border-red-500/30 rounded-full text-sm font-medium">
                      <Ban className="h-3.5 w-3.5" /> Suspended
                    </span>
                  )}
                </div>
              </div>

              {/* Profile fields */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-400">Date of Birth</span>
                  <p className="text-slate-100 font-medium">
                    {selectedPatient.date_of_birth
                      ? new Date(
                          selectedPatient.date_of_birth,
                        ).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Gender</span>
                  <p className="text-slate-100 font-medium capitalize">
                    {selectedPatient.gender || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Blood Type</span>
                  <p className="text-slate-100 font-medium">
                    {selectedPatient.blood_type || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Ward</span>
                  <p className="text-slate-100 font-medium">
                    {selectedPatient.ward_name || "—"}
                  </p>
                </div>
              </div>

              {/* Stats badges */}
              <div className="flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/15 text-blue-200 border border-blue-500/30 rounded-full text-sm font-medium">
                  <Users className="h-4 w-4" />
                  {selectedPatient.stats.staff_count} staff
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-pink-500/15 text-pink-200 border border-pink-500/30 rounded-full text-sm font-medium">
                  <Heart className="h-4 w-4" />
                  {selectedPatient.stats.caregiver_count} caregiver
                  {selectedPatient.stats.caregiver_count !== 1 ? "s" : ""}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 text-amber-200 border border-amber-500/30 rounded-full text-sm font-medium">
                  <CalendarCheck className="h-4 w-4" />
                  {Number(selectedPatient.appointment_stats.total)} appointment
                  {Number(selectedPatient.appointment_stats.total) !== 1
                    ? "s"
                    : ""}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 text-emerald-200 border border-emerald-500/30 rounded-full text-sm font-medium">
                  <FileText className="h-4 w-4" />
                  {selectedPatient.stats.record_count} record
                  {selectedPatient.stats.record_count !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Assigned staff */}
              <div>
                <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Assigned Staff
                </h4>
                {selectedPatient.assigned_staff.length === 0 ? (
                  <p className="text-slate-500 text-sm">No staff assigned</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700/50">
                          <th className="text-left py-2 px-3 font-semibold text-slate-300">
                            Name
                          </th>
                          <th className="text-left py-2 px-3 font-semibold text-slate-300">
                            Email
                          </th>
                          <th className="text-left py-2 px-3 font-semibold text-slate-300">
                            Role
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPatient.assigned_staff.map((s) => (
                          <tr
                            key={s.id}
                            className="border-b border-slate-800/50 hover:bg-slate-800/40"
                          >
                            <td className="py-2 px-3 text-slate-100">
                              {s.staff_name}
                            </td>
                            <td className="py-2 px-3 text-slate-400">
                              {s.staff_email}
                            </td>
                            <td className="py-2 px-3 text-slate-400 capitalize">
                              {s.role}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Caregivers */}
              <div>
                <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Caregivers
                </h4>
                {selectedPatient.caregivers.length === 0 ? (
                  <p className="text-slate-500 text-sm">No caregivers linked</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700/50">
                          <th className="text-left py-2 px-3 font-semibold text-slate-300">
                            Name
                          </th>
                          <th className="text-left py-2 px-3 font-semibold text-slate-300">
                            Email
                          </th>
                          <th className="text-left py-2 px-3 font-semibold text-slate-300">
                            Relationship
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPatient.caregivers.map((c) => (
                          <tr
                            key={c.id}
                            className="border-b border-slate-800/50 hover:bg-slate-800/40"
                          >
                            <td className="py-2 px-3 text-slate-100">
                              {c.caregiver_name}
                            </td>
                            <td className="py-2 px-3 text-slate-400">
                              {c.caregiver_email}
                            </td>
                            <td className="py-2 px-3 text-slate-400">
                              {c.relationship || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-slate-400 text-center py-8">
              Failed to load patient details.
            </p>
          )}
        </Modal>
      )}

      {/* ── Create / Edit modal ── */}
      {showForm && (
        <Modal
          title={editingPatient ? "Edit Patient" : "Add Patient"}
          onClose={closeForm}
        >
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Name
              </label>
              <input
                type="text"
                className="input-field w-full"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Email
              </label>
              <input
                type="email"
                className="input-field w-full"
                required
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="patient@example.com"
              />
            </div>
            {!editingPatient && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  className="input-field w-full"
                  required
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Date of Birth
              </label>
              <input
                type="date"
                className="input-field w-full"
                value={formDob}
                onChange={(e) => setFormDob(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Gender
                </label>
                <select
                  className="input-field w-full"
                  value={formGender}
                  onChange={(e) => setFormGender(e.target.value)}
                >
                  <option value="">Select…</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Blood Type
                </label>
                <select
                  className="input-field w-full"
                  value={formBloodType}
                  onChange={(e) => setFormBloodType(e.target.value)}
                >
                  <option value="">Select…</option>
                  {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(
                    (bt) => (
                      <option key={bt} value={bt}>
                        {bt}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Ward
              </label>
              <select
                className="input-field w-full"
                value={formWardId}
                onChange={(e) =>
                  setFormWardId(e.target.value ? Number(e.target.value) : "")
                }
              >
                <option value="">No ward</option>
                {allWards.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            {formError && <p className="text-red-400 text-sm">{formError}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={closeForm}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formSubmitting}
                className="btn-primary"
              >
                {formSubmitting
                  ? "Saving…"
                  : editingPatient
                    ? "Save Changes"
                    : "Create Patient"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default PatientsPage;
