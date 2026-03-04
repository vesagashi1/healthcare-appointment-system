import { useEffect, useState } from "react";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import {
  HeartPulse,
  X,
  Building2,
  Users,
  Plus,
  Pencil,
  Ban,
  RotateCcw,
  Trash2,
} from "lucide-react";

/* ───── types ───── */

interface NurseListItem {
  user_id: number;
  name: string;
  email: string;
  created_at: string;
  ward_count: number | string;
  active: boolean;
}

interface NurseWard {
  id: number;
  name: string;
}
interface NursePatient {
  id: number;
  user_id: number;
  name: string;
  email: string;
  ward_id: number | null;
  ward_name: string | null;
}

interface NurseDetail {
  id: number;
  name: string;
  email: string;
  created_at: string;
  active: boolean;
  wards: NurseWard[];
  assigned_patients: NursePatient[];
  stats: { ward_count: number; patient_count: number };
}

interface WardOption {
  id: number;
  name: string;
}

/* ───── reusable modal ───── */

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

const NursesPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  /* ── list ── */
  const [nurses, setNurses] = useState<NurseListItem[]>([]);
  const [loading, setLoading] = useState(true);

  /* ── detail ── */
  const [selectedNurse, setSelectedNurse] = useState<NurseDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  /* ── create / edit ── */
  const [showForm, setShowForm] = useState(false);
  const [editingNurse, setEditingNurse] = useState<NurseListItem | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);

  /* ── ward assignment ── */
  const [showAssignWard, setShowAssignWard] = useState(false);
  const [assignNurseId, setAssignNurseId] = useState<number | null>(null);
  const [allWards, setAllWards] = useState<WardOption[]>([]);
  const [selectedWardId, setSelectedWardId] = useState<number | "">("");
  const [assignError, setAssignError] = useState("");

  useEffect(() => {
    fetchNurses();
  }, []);

  /* ── data fetching ── */

  const fetchNurses = async () => {
    try {
      const res = await api.get("/nurses");
      setNurses(res.data.nurses || []);
    } catch (err) {
      console.error("Error fetching nurses:", err);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (nurseUserId: number) => {
    setShowDetail(true);
    setSelectedNurse(null);
    setLoadingDetail(true);
    try {
      const res = await api.get(`/nurses/${nurseUserId}`);
      setSelectedNurse(res.data.nurse || null);
    } catch (err) {
      console.error("Error fetching nurse details:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetail = () => {
    setShowDetail(false);
    setSelectedNurse(null);
  };

  /* ── create / edit handlers ── */

  const openCreate = () => {
    setEditingNurse(null);
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (nurse: NurseListItem) => {
    setEditingNurse(nurse);
    setFormName(nurse.name);
    setFormEmail(nurse.email);
    setFormPassword("");
    setFormError("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingNurse(null);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSubmitting(true);
    try {
      if (editingNurse) {
        await api.patch(`/nurses/${editingNurse.user_id}`, {
          name: formName,
          email: formEmail,
        });
      } else {
        if (!formPassword) {
          setFormError("Password is required for new nurse");
          setFormSubmitting(false);
          return;
        }
        await api.post("/nurses", {
          name: formName,
          email: formEmail,
          password: formPassword,
        });
      }
      closeForm();
      await fetchNurses();
      // Refresh detail if open
      if (
        showDetail &&
        selectedNurse &&
        editingNurse?.user_id === selectedNurse.id
      ) {
        openDetail(selectedNurse.id);
      }
    } catch (err: any) {
      setFormError(err?.response?.data?.message || "Something went wrong");
    } finally {
      setFormSubmitting(false);
    }
  };

  /* ── suspend / restore ── */

  const handleSuspend = async (nurseId: number) => {
    if (
      !confirm(
        "Suspend this nurse? Their ward and patient assignments will be removed.",
      )
    )
      return;
    try {
      await api.delete(`/nurses/${nurseId}`);
      await fetchNurses();
      if (showDetail && selectedNurse?.id === nurseId) openDetail(nurseId);
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to suspend nurse");
    }
  };

  const handleRestore = async (nurseId: number) => {
    try {
      await api.patch(`/nurses/${nurseId}/restore`);
      await fetchNurses();
      if (showDetail && selectedNurse?.id === nurseId) openDetail(nurseId);
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to restore nurse");
    }
  };

  /* ── ward assignment ── */

  const openWardAssign = async (nurseId: number) => {
    setAssignNurseId(nurseId);
    setSelectedWardId("");
    setAssignError("");
    try {
      const res = await api.get("/wards");
      setAllWards(
        (res.data.wards || []).filter((w: any) => w.active !== false),
      );
    } catch {
      setAllWards([]);
    }
    setShowAssignWard(true);
  };

  const handleAssignWard = async () => {
    if (!assignNurseId || !selectedWardId) return;
    setAssignError("");
    try {
      await api.post(`/nurses/${assignNurseId}/wards`, {
        ward_id: selectedWardId,
      });
      setShowAssignWard(false);
      await fetchNurses();
      if (showDetail && selectedNurse?.id === assignNurseId)
        openDetail(assignNurseId);
    } catch (err: any) {
      setAssignError(err?.response?.data?.message || "Failed to assign ward");
    }
  };

  const handleUnassignWard = async (nurseId: number, wardId: number) => {
    try {
      await api.delete(`/nurses/${nurseId}/wards/${wardId}`);
      await fetchNurses();
      if (showDetail && selectedNurse?.id === nurseId) openDetail(nurseId);
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to unassign ward");
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
          <HeartPulse className="h-8 w-8 text-primary-600 mr-3" />
          <h1 className="text-3xl font-bold text-slate-100">Nurses</h1>
        </div>
        {isAdmin && (
          <button
            onClick={openCreate}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Add Nurse
          </button>
        )}
      </div>

      {/* Cards grid */}
      {nurses.length === 0 ? (
        <div className="card text-center py-12">
          <HeartPulse className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-slate-300">No nurses found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {nurses.map((nurse) => (
            <div
              key={nurse.user_id}
              className={`card hover:shadow-lg transition-shadow ${nurse.active === false ? "opacity-60" : ""}`}
            >
              <button
                type="button"
                onClick={() => openDetail(nurse.user_id)}
                className="text-left w-full"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="min-w-0">
                    <h3 className="text-xl font-semibold text-slate-100 truncate">
                      {nurse.name}
                    </h3>
                    <p className="text-sm text-slate-300 truncate">
                      {nurse.email}
                    </p>
                  </div>
                  <div
                    className={`p-2 rounded-full border ${nurse.active === false ? "bg-red-500/15 border-red-500/25" : "bg-teal-500/15 border-teal-500/25"}`}
                  >
                    <HeartPulse
                      className={`h-6 w-6 ${nurse.active === false ? "text-red-300" : "text-teal-300"}`}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-teal-500/15 text-teal-200 border border-teal-500/30 rounded-full text-sm font-medium">
                    <Building2 className="h-3.5 w-3.5" />
                    {Number(nurse.ward_count)} ward
                    {Number(nurse.ward_count) !== 1 ? "s" : ""}
                  </span>
                  {nurse.active === false && (
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
                    onClick={() => openEdit(nurse)}
                    className="flex items-center gap-1 text-sm text-slate-300 hover:text-blue-300 transition-colors"
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  {nurse.active !== false && (
                    <button
                      onClick={() => openWardAssign(nurse.user_id)}
                      className="flex items-center gap-1 text-sm text-slate-300 hover:text-teal-300 transition-colors"
                      title="Assign Ward"
                    >
                      <Building2 className="h-3.5 w-3.5" /> Assign Ward
                    </button>
                  )}
                  {nurse.active === false ? (
                    <button
                      onClick={() => handleRestore(nurse.user_id)}
                      className="flex items-center gap-1 text-sm text-slate-300 hover:text-green-300 transition-colors ml-auto"
                      title="Restore"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Restore
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSuspend(nurse.user_id)}
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
        <Modal title="Nurse Details" onClose={closeDetail} wide>
          {loadingDetail ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
            </div>
          ) : selectedNurse ? (
            <div className="space-y-6">
              {/* Basic info */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">
                    {selectedNurse.name}
                  </h3>
                  <p className="text-sm text-slate-400">
                    {selectedNurse.email}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Joined{" "}
                    {new Date(selectedNurse.created_at).toLocaleDateString()}
                  </p>
                </div>
                {selectedNurse.active === false && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-500/15 text-red-200 border border-red-500/30 rounded-full text-sm font-medium">
                    <Ban className="h-3.5 w-3.5" /> Suspended
                  </span>
                )}
              </div>

              {/* Stats badges */}
              <div className="flex gap-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-500/15 text-teal-200 border border-teal-500/30 rounded-full text-sm font-medium">
                  <Building2 className="h-4 w-4" />
                  {selectedNurse.stats.ward_count} ward
                  {selectedNurse.stats.ward_count !== 1 ? "s" : ""}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/15 text-blue-200 border border-blue-500/30 rounded-full text-sm font-medium">
                  <Users className="h-4 w-4" />
                  {selectedNurse.stats.patient_count} patient
                  {selectedNurse.stats.patient_count !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Assigned wards with unassign */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                    Assigned Wards
                  </h4>
                  {isAdmin && selectedNurse.active !== false && (
                    <button
                      onClick={() => openWardAssign(selectedNurse.id)}
                      className="text-xs text-teal-400 hover:text-teal-300"
                    >
                      + Assign Ward
                    </button>
                  )}
                </div>
                {selectedNurse.wards.length === 0 ? (
                  <p className="text-slate-500 text-sm">No wards assigned</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selectedNurse.wards.map((ward) => (
                      <span
                        key={ward.id}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200"
                      >
                        <Building2 className="h-3.5 w-3.5 text-teal-400" />
                        {ward.name}
                        {isAdmin && (
                          <button
                            onClick={() =>
                              handleUnassignWard(selectedNurse.id, ward.id)
                            }
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
                <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Assigned Patients
                </h4>
                {selectedNurse.assigned_patients.length === 0 ? (
                  <p className="text-slate-500 text-sm">No patients assigned</p>
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
                        </tr>
                      </thead>
                      <tbody>
                        {selectedNurse.assigned_patients.map((patient) => (
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
              Failed to load nurse details.
            </p>
          )}
        </Modal>
      )}

      {/* ── Create / Edit modal ── */}
      {showForm && (
        <Modal
          title={editingNurse ? "Edit Nurse" : "Add Nurse"}
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
                placeholder="nurse@example.com"
              />
            </div>
            {!editingNurse && (
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
                  : editingNurse
                    ? "Save Changes"
                    : "Create Nurse"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Assign Ward modal ── */}
      {showAssignWard && (
        <Modal
          title="Assign Nurse to Ward"
          onClose={() => setShowAssignWard(false)}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Ward
              </label>
              <select
                className="input-field w-full"
                value={selectedWardId}
                onChange={(e) =>
                  setSelectedWardId(
                    e.target.value ? Number(e.target.value) : "",
                  )
                }
              >
                <option value="">Select a ward…</option>
                {allWards.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            {assignError && (
              <p className="text-red-400 text-sm">{assignError}</p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAssignWard(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssignWard}
                disabled={!selectedWardId}
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
};

export default NursesPage;
