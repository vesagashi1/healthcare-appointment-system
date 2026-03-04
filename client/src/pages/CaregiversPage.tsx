import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Users,
  X,
  Plus,
  Pencil,
  Ban,
  RotateCcw,
  Trash2,
  UserPlus,
  Heart,
} from "lucide-react";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";

/* ───── types ───── */

interface CaregiverListItem {
  id: number;
  name: string;
  email: string;
  created_at: string;
  active: boolean;
  linked_patient_count: string | number;
}

interface LinkedPatient {
  patient_table_id: number;
  user_id: number;
  name: string;
  email: string;
  ward_id: number | null;
  ward_name: string | null;
  relationship: string;
  linked_at: string;
}

interface CaregiverDetail {
  id: number;
  name: string;
  email: string;
  created_at: string;
  active: boolean;
  linked_patients: LinkedPatient[];
  stats: { patient_count: number };
}

interface PatientOption {
  id: number;           // patients.id
  user_id: number;      // users.id
  name: string;
  email: string;
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
        className={`bg-slate-950 text-slate-100 w-full ${
          wide ? "max-w-3xl" : "max-w-lg"
        } rounded-lg shadow-lg overflow-hidden border border-slate-800 max-h-[90vh] flex flex-col`}
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

export default function CaregiversPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const hasPermission = (permissionName: string) =>
    Array.isArray(user?.permissions) &&
    user.permissions.includes(permissionName);

  const canViewCaregivers =
    user?.role === "admin" || hasPermission("MANAGE_USERS");

  /* ── list ── */
  const [caregivers, setCaregivers] = useState<CaregiverListItem[]>([]);
  const [loading, setLoading] = useState(true);

  /* ── detail ── */
  const [selectedCaregiver, setSelectedCaregiver] =
    useState<CaregiverDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  /* ── create / edit ── */
  const [showForm, setShowForm] = useState(false);
  const [editingCaregiver, setEditingCaregiver] =
    useState<CaregiverListItem | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);

  /* ── patient assignment ── */
  const [showAssignPatient, setShowAssignPatient] = useState(false);
  const [assignCaregiverId, setAssignCaregiverId] = useState<number | null>(
    null,
  );
  const [allPatients, setAllPatients] = useState<PatientOption[]>([]);
  const [selectedPatientUserId, setSelectedPatientUserId] = useState<
    number | ""
  >("");
  const [assignRelationship, setAssignRelationship] = useState("caregiver");
  const [assignError, setAssignError] = useState("");

  useEffect(() => {
    if (user && canViewCaregivers) {
      void fetchCaregivers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, canViewCaregivers]);

  /* ── data fetching ── */

  const fetchCaregivers = async () => {
    try {
      const res = await api.get("/caregivers");
      setCaregivers(res.data.caregivers || []);
    } catch (err) {
      console.error("Error fetching caregivers:", err);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (caregiverId: number) => {
    setShowDetail(true);
    setSelectedCaregiver(null);
    setLoadingDetail(true);
    try {
      const res = await api.get(`/caregivers/${caregiverId}`);
      setSelectedCaregiver(res.data.caregiver || null);
    } catch (err) {
      console.error("Error fetching caregiver details:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetail = () => {
    setShowDetail(false);
    setSelectedCaregiver(null);
  };

  /* ── create / edit ── */

  const openCreate = () => {
    setEditingCaregiver(null);
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (caregiver: CaregiverListItem) => {
    setEditingCaregiver(caregiver);
    setFormName(caregiver.name);
    setFormEmail(caregiver.email);
    setFormPassword("");
    setFormError("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingCaregiver(null);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSubmitting(true);
    try {
      if (editingCaregiver) {
        await api.patch(`/caregivers/${editingCaregiver.id}`, {
          name: formName,
          email: formEmail,
        });
      } else {
        if (!formPassword) {
          setFormError("Password is required for new caregiver");
          setFormSubmitting(false);
          return;
        }
        await api.post("/caregivers", {
          name: formName,
          email: formEmail,
          password: formPassword,
        });
      }
      closeForm();
      await fetchCaregivers();
      if (
        showDetail &&
        selectedCaregiver &&
        editingCaregiver?.id === selectedCaregiver.id
      ) {
        openDetail(selectedCaregiver.id);
      }
    } catch (err: any) {
      setFormError(err?.response?.data?.message || "Something went wrong");
    } finally {
      setFormSubmitting(false);
    }
  };

  /* ── suspend / restore ── */

  const handleSuspend = async (caregiverId: number) => {
    if (
      !confirm(
        "Suspend this caregiver? Their patient assignments will be removed.",
      )
    )
      return;
    try {
      await api.delete(`/caregivers/${caregiverId}`);
      await fetchCaregivers();
      if (showDetail && selectedCaregiver?.id === caregiverId)
        openDetail(caregiverId);
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to suspend caregiver");
    }
  };

  const handleRestore = async (caregiverId: number) => {
    try {
      await api.patch(`/caregivers/${caregiverId}/restore`);
      await fetchCaregivers();
      if (showDetail && selectedCaregiver?.id === caregiverId)
        openDetail(caregiverId);
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to restore caregiver");
    }
  };

  /* ── patient assignment ── */

  const openPatientAssign = async (caregiverId: number) => {
    setAssignCaregiverId(caregiverId);
    setSelectedPatientUserId("");
    setAssignRelationship("caregiver");
    setAssignError("");
    try {
      const res = await api.get("/patients");
      setAllPatients(
        (res.data.patients || []).map((p: any) => ({
          id: p.id,
          user_id: p.user_id ?? p.id,
          name: p.name,
          email: p.email,
        })),
      );
    } catch {
      setAllPatients([]);
    }
    setShowAssignPatient(true);
  };

  const handleAssignPatient = async () => {
    if (!assignCaregiverId || !selectedPatientUserId) return;
    setAssignError("");
    try {
      await api.post(`/caregivers/${assignCaregiverId}/patients`, {
        patient_user_id: selectedPatientUserId,
        relationship: assignRelationship || "caregiver",
      });
      setShowAssignPatient(false);
      await fetchCaregivers();
      if (showDetail && selectedCaregiver?.id === assignCaregiverId)
        openDetail(assignCaregiverId);
    } catch (err: any) {
      setAssignError(
        err?.response?.data?.message || "Failed to assign patient",
      );
    }
  };

  const handleUnassignPatient = async (
    caregiverId: number,
    patientUserId: number,
  ) => {
    try {
      await api.delete(`/caregivers/${caregiverId}/patients/${patientUserId}`);
      await fetchCaregivers();
      if (showDetail && selectedCaregiver?.id === caregiverId)
        openDetail(caregiverId);
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to unassign patient");
    }
  };

  /* ── guards ── */

  if (!user) return <Navigate to="/login" replace />;
  if (!canViewCaregivers) return <Navigate to="/dashboard" replace />;

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
          <Heart className="h-8 w-8 text-primary-600 mr-3" />
          <h1 className="text-3xl font-bold text-slate-100">Caregivers</h1>
        </div>
        {isAdmin && (
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Caregiver
          </button>
        )}
      </div>

      {/* Cards grid */}
      {caregivers.length === 0 ? (
        <div className="card text-center py-12">
          <Heart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-slate-300">No caregivers found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {caregivers.map((cg) => (
            <div
              key={cg.id}
              className={`card hover:shadow-lg transition-shadow ${
                cg.active === false ? "opacity-60" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => openDetail(cg.id)}
                className="text-left w-full"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="min-w-0">
                    <h3 className="text-xl font-semibold text-slate-100 truncate">
                      {cg.name}
                    </h3>
                    <p className="text-sm text-slate-300 truncate">{cg.email}</p>
                  </div>
                  <div
                    className={`p-2 rounded-full border ${
                      cg.active === false
                        ? "bg-red-500/15 border-red-500/25"
                        : "bg-rose-500/15 border-rose-500/25"
                    }`}
                  >
                    <Heart
                      className={`h-6 w-6 ${
                        cg.active === false ? "text-red-300" : "text-rose-300"
                      }`}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-500/15 text-blue-200 border border-blue-500/30 rounded-full text-sm font-medium">
                    <Users className="h-3.5 w-3.5" />
                    {Number(cg.linked_patient_count)} patient
                    {Number(cg.linked_patient_count) !== 1 ? "s" : ""}
                  </span>
                  {cg.active === false && (
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
                    onClick={() => openEdit(cg)}
                    className="flex items-center gap-1 text-sm text-slate-300 hover:text-blue-300 transition-colors"
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  {cg.active !== false && (
                    <button
                      onClick={() => openPatientAssign(cg.id)}
                      className="flex items-center gap-1 text-sm text-slate-300 hover:text-emerald-300 transition-colors"
                      title="Assign Patient"
                    >
                      <UserPlus className="h-3.5 w-3.5" /> Assign Patient
                    </button>
                  )}
                  {cg.active === false ? (
                    <button
                      onClick={() => handleRestore(cg.id)}
                      className="flex items-center gap-1 text-sm text-slate-300 hover:text-green-300 transition-colors ml-auto"
                      title="Restore"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Restore
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSuspend(cg.id)}
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
        <Modal title="Caregiver Details" onClose={closeDetail} wide>
          {loadingDetail ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
            </div>
          ) : selectedCaregiver ? (
            <div className="space-y-6">
              {/* Basic info */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">
                    {selectedCaregiver.name}
                  </h3>
                  <p className="text-sm text-slate-400">
                    {selectedCaregiver.email}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Joined{" "}
                    {new Date(selectedCaregiver.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedCaregiver.active === false && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-500/15 text-red-200 border border-red-500/30 rounded-full text-sm font-medium">
                      <Ban className="h-3.5 w-3.5" /> Suspended
                    </span>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/15 text-blue-200 border border-blue-500/30 rounded-full text-sm font-medium">
                  <Users className="h-4 w-4" />
                  {selectedCaregiver.stats.patient_count} patient
                  {selectedCaregiver.stats.patient_count !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Linked patients with unassign */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                    Linked Patients
                  </h4>
                  {isAdmin && selectedCaregiver.active !== false && (
                    <button
                      onClick={() => openPatientAssign(selectedCaregiver.id)}
                      className="text-xs text-emerald-400 hover:text-emerald-300"
                    >
                      + Assign Patient
                    </button>
                  )}
                </div>
                {selectedCaregiver.linked_patients.length === 0 ? (
                  <p className="text-slate-500 text-sm">No patients linked</p>
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
                            Ward
                          </th>
                          <th className="text-left py-2 px-3 font-semibold text-slate-300">
                            Relationship
                          </th>
                          {isAdmin && (
                            <th className="text-right py-2 px-3 font-semibold text-slate-300">
                              Actions
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedCaregiver.linked_patients.map((patient) => (
                          <tr
                            key={patient.user_id}
                            className="border-b border-slate-800/50 hover:bg-slate-800/40"
                          >
                            <td className="py-2 px-3 text-slate-100">
                              {patient.name}
                            </td>
                            <td className="py-2 px-3 text-slate-400">
                              {patient.email}
                            </td>
                            <td className="py-2 px-3 text-slate-400">
                              {patient.ward_name ?? "—"}
                            </td>
                            <td className="py-2 px-3">
                              <span className="inline-block px-2 py-0.5 bg-rose-500/15 text-rose-200 border border-rose-500/30 rounded text-xs capitalize">
                                {patient.relationship}
                              </span>
                            </td>
                            {isAdmin && (
                              <td className="py-2 px-3 text-right">
                                <button
                                  onClick={() =>
                                    handleUnassignPatient(
                                      selectedCaregiver.id,
                                      patient.user_id,
                                    )
                                  }
                                  className="p-1 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-300"
                                  title="Unassign patient"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            )}
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
              Failed to load caregiver details.
            </p>
          )}
        </Modal>
      )}

      {/* ── Create / Edit modal ── */}
      {showForm && (
        <Modal
          title={editingCaregiver ? "Edit Caregiver" : "Add Caregiver"}
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
                placeholder="caregiver@example.com"
              />
            </div>
            {!editingCaregiver && (
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
            {formError && (
              <p className="text-red-400 text-sm">{formError}</p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={closeForm} className="btn-secondary">
                Cancel
              </button>
              <button
                type="submit"
                disabled={formSubmitting}
                className="btn-primary"
              >
                {formSubmitting
                  ? "Saving…"
                  : editingCaregiver
                    ? "Save Changes"
                    : "Create Caregiver"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Assign Patient modal ── */}
      {showAssignPatient && (
        <Modal
          title="Assign Patient to Caregiver"
          onClose={() => setShowAssignPatient(false)}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Patient
              </label>
              <select
                className="input-field w-full"
                value={selectedPatientUserId}
                onChange={(e) =>
                  setSelectedPatientUserId(
                    e.target.value ? Number(e.target.value) : "",
                  )
                }
              >
                <option value="">Select a patient…</option>
                {allPatients.map((p) => (
                  <option key={p.user_id} value={p.user_id}>
                    {p.name} ({p.email})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Relationship
              </label>
              <input
                type="text"
                className="input-field w-full"
                value={assignRelationship}
                onChange={(e) => setAssignRelationship(e.target.value)}
                placeholder="e.g. parent, spouse, caregiver"
              />
            </div>
            {assignError && (
              <p className="text-red-400 text-sm">{assignError}</p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAssignPatient(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssignPatient}
                disabled={!selectedPatientUserId}
                className="btn-primary"
              >
                Assign
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
