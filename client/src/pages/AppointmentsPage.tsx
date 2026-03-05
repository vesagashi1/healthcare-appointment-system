import { useState, useEffect, useMemo } from "react";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import {
  Calendar,
  Plus,
  Check,
  CheckCircle,
  X,
  Clock,
  CalendarClock,
  Trash2,
  Eye,
  Stethoscope,
  User,
  Search,
} from "lucide-react";
import { format } from "date-fns";
import DatePicker from "../components/DatePicker";

/* ───── types ───── */

interface Appointment {
  id: number;
  appointment_date: string;
  status: string;
  created_at: string;
  doctor_id: number;
  doctor_name: string;
  doctor_email?: string;
  specialization?: string;
  patient_id: number;
  patient_name: string;
  patient_email?: string;
  patient_user_id?: number;
}

interface DoctorOption {
  id: number;
  name: string;
  specialization: string;
}

interface PatientOption {
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
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

/* ───── main ───── */

const STATUS_TABS = [
  "all",
  "requested",
  "scheduled",
  "completed",
  "cancelled",
] as const;

const AppointmentsPage = () => {
  const PAGE_SIZE = 8;
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user?.role === "admin";
  const isDoctor = user?.role === "doctor";
  const isPatient = user?.role === "patient";

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchField, setSearchField] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // modals
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<Appointment | null>(null);
  const [showReschedule, setShowReschedule] = useState<Appointment | null>(
    null,
  );

  // form
  const [form, setForm] = useState({
    doctor_id: "",
    patient_id: "",
    appointment_date: null as Date | null,
  });
  const [rescheduleDate, setRescheduleDate] = useState<Date | null>(null);

  /* ── fetch ── */

  useEffect(() => {
    fetchAppointments();
    fetchDoctors();
    if (isAdmin) fetchPatients();
  }, [user]);

  const fetchAppointments = async () => {
    try {
      const res = await api.get("/appointments/my-appointments/list");
      setAppointments(res.data.appointments || []);
    } catch {
      toast.error("Failed to load appointments");
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctors = async () => {
    try {
      const res = await api.get("/doctors");
      setDoctors(res.data.doctors || []);
    } catch {
      console.error("Failed to load doctors");
    }
  };

  const fetchPatients = async () => {
    try {
      const res = await api.get("/patients");
      setPatients(res.data.patients || []);
    } catch {
      console.error("Failed to load patients");
    }
  };

  /* ── actions ── */

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        doctor_id: form.doctor_id,
        appointment_date: form.appointment_date?.toISOString(),
      };
      if (isAdmin && form.patient_id) payload.patient_id = form.patient_id;
      await api.post("/appointments", payload);
      toast.success("Appointment created");
      setShowCreate(false);
      setForm({ doctor_id: "", patient_id: "", appointment_date: null });
      fetchAppointments();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Failed to create appointment",
      );
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await api.patch(`/appointments/${id}/approve`);
      toast.success("Appointment approved");
      fetchAppointments();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to approve");
    }
  };

  const handleComplete = async (id: number) => {
    try {
      await api.patch(`/appointments/${id}/complete`);
      toast.success("Appointment completed");
      fetchAppointments();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to complete");
    }
  };

  const handleCancel = async (id: number) => {
    try {
      await api.patch(`/appointments/${id}/cancel`);
      toast.success("Appointment cancelled");
      fetchAppointments();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to cancel");
    }
  };

  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showReschedule) return;
    try {
      await api.patch(`/appointments/${showReschedule.id}/reschedule`, {
        appointment_date: rescheduleDate?.toISOString(),
      });
      toast.success("Appointment rescheduled");
      setShowReschedule(null);
      setRescheduleDate(null);
      fetchAppointments();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to reschedule");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Permanently delete this appointment?")) return;
    try {
      await api.delete(`/appointments/${id}`);
      toast.success("Appointment deleted");
      setShowDetail(null);
      fetchAppointments();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete");
    }
  };

  /* ── helpers ── */

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "bg-green-500/15 text-green-200 border border-green-500/30";
      case "requested":
        return "bg-yellow-500/15 text-yellow-200 border border-yellow-500/30";
      case "cancelled":
        return "bg-red-500/15 text-red-200 border border-red-500/30";
      case "completed":
        return "bg-blue-500/15 text-blue-200 border border-blue-500/30";
      case "no_show":
        return "bg-slate-500/15 text-slate-300 border border-slate-500/30";
      default:
        return "bg-slate-500/15 text-slate-200 border border-slate-500/30";
    }
  };

  const filtered =
    statusFilter === "all"
      ? appointments
      : appointments.filter((a) => a.status === statusFilter);

  const searchedAppointments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return filtered;

    return filtered.filter((appt) => {
      const appointmentDate = format(
        new Date(appt.appointment_date),
        "MMM d, yyyy h:mm a",
      );
      const targets =
        searchField === "doctor"
          ? [appt.doctor_name]
          : searchField === "patient"
            ? [appt.patient_name]
            : searchField === "status"
              ? [appt.status]
              : searchField === "date"
                ? [appointmentDate]
                : [appt.doctor_name, appt.patient_name, appt.status, appointmentDate];

      return targets.some((value) => value.toLowerCase().includes(q));
    });
  }, [filtered, searchField, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(searchedAppointments.length / PAGE_SIZE));
  const paginatedAppointments = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return searchedAppointments.slice(start, start + PAGE_SIZE);
  }, [currentPage, searchedAppointments]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchField, searchQuery]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const canReschedule = (a: Appointment) =>
    (isDoctor || isAdmin) && !["completed", "cancelled"].includes(a.status);

  const canApprove = (a: Appointment) =>
    (isDoctor || isAdmin) && a.status === "requested";

  const canComplete = (a: Appointment) =>
    (isDoctor || isAdmin) && a.status === "scheduled";

  const canCancel = (a: Appointment) =>
    (isPatient || isDoctor || isAdmin) &&
    !["completed", "cancelled"].includes(a.status);

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
      {/* header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-slate-100">Appointments</h1>
        {(isPatient || isAdmin) && (
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary flex items-center"
          >
            <Plus className="mr-2 h-5 w-5" />
            {isAdmin ? "Create Appointment" : "Request Appointment"}
          </button>
        )}
      </div>

      {/* status filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {STATUS_TABS.map((tab) => {
          const count =
            tab === "all"
              ? appointments.length
              : appointments.filter((a) => a.status === tab).length;
          return (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                statusFilter === tab
                  ? "bg-primary-600 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {tab} ({count})
            </button>
          );
        })}
      </div>

      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative md:col-span-2">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            className="input-field w-full pl-9"
            placeholder="Search appointments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select className="input-field w-full" value={searchField} onChange={(e) => setSearchField(e.target.value)}>
          <option value="all">Search: All fields</option>
          <option value="doctor">Search: Doctor</option>
          <option value="patient">Search: Patient</option>
          <option value="status">Search: Status</option>
          <option value="date">Search: Date</option>
        </select>
      </div>

      {/* list */}
      {searchedAppointments.length === 0 ? (
        <div className="card text-center py-12">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-slate-300">
            {filtered.length === 0 ? "No appointments found" : "No appointments match your search"}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {paginatedAppointments.map((appt) => (
            <div
              key={appt.id}
              className="card hover:border-slate-600 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <span className="flex items-center gap-1 font-semibold text-lg text-slate-100">
                      <Clock className="h-5 w-5 text-slate-400 shrink-0" />
                      {format(
                        new Date(appt.appointment_date),
                        "MMM d, yyyy 'at' h:mm a",
                      )}
                    </span>
                    <span
                      className={`px-3 py-0.5 rounded-full text-xs font-medium ${getStatusColor(appt.status)}`}
                    >
                      {appt.status}
                    </span>
                  </div>
                  <div className="flex gap-6 text-sm text-slate-300">
                    <span className="flex items-center gap-1">
                      <Stethoscope className="h-4 w-4 text-slate-500" />
                      {appt.doctor_name}
                      {appt.specialization && (
                        <span className="text-slate-500">
                          ({appt.specialization})
                        </span>
                      )}
                    </span>
                    {(isDoctor || isAdmin) && (
                      <span className="flex items-center gap-1">
                        <User className="h-4 w-4 text-slate-500" />
                        {appt.patient_name}
                      </span>
                    )}
                  </div>
                </div>

                {/* action buttons */}
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setShowDetail(appt)}
                    className="p-2 bg-slate-700/50 text-slate-300 border border-slate-600/40 rounded-lg hover:bg-slate-700"
                    title="View details"
                  >
                    <Eye className="h-5 w-5" />
                  </button>
                  {canApprove(appt) && (
                    <button
                      onClick={() => handleApprove(appt.id)}
                      className="p-2 bg-green-500/15 text-green-200 border border-green-500/30 rounded-lg hover:bg-green-500/25"
                      title="Approve & Schedule"
                    >
                      <Check className="h-5 w-5" />
                    </button>
                  )}
                  {canComplete(appt) && (
                    <button
                      onClick={() => handleComplete(appt.id)}
                      className="p-2 bg-blue-500/15 text-blue-200 border border-blue-500/30 rounded-lg hover:bg-blue-500/25"
                      title="Mark as Completed"
                    >
                      <CheckCircle className="h-5 w-5" />
                    </button>
                  )}
                  {canReschedule(appt) && (
                    <button
                      onClick={() => {
                        setShowReschedule(appt);
                        setRescheduleDate(null);
                      }}
                      className="p-2 bg-purple-500/15 text-purple-200 border border-purple-500/30 rounded-lg hover:bg-purple-500/25"
                      title="Reschedule"
                    >
                      <CalendarClock className="h-5 w-5" />
                    </button>
                  )}
                  {canCancel(appt) && (
                    <button
                      onClick={() => handleCancel(appt.id)}
                      className="p-2 bg-red-500/15 text-red-200 border border-red-500/30 rounded-lg hover:bg-red-500/25"
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

      {searchedAppointments.length > 0 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-slate-400">
            Page {currentPage} of {totalPages} ({searchedAppointments.length} result
            {searchedAppointments.length !== 1 ? "s" : ""})
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

      {/* ──────── Create Modal ──────── */}
      {showCreate && (
        <Modal
          title={isAdmin ? "Create Appointment" : "Request New Appointment"}
          onClose={() => setShowCreate(false)}
        >
          <form onSubmit={handleCreate} className="space-y-4">
            {isAdmin && (
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Patient
                </label>
                <select
                  value={form.patient_id}
                  onChange={(e) =>
                    setForm({ ...form, patient_id: e.target.value })
                  }
                  className="input-field"
                  required
                >
                  <option value="">Select a patient</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                Doctor
              </label>
              {doctors.length === 0 && (
                <p className="mb-2 text-xs text-amber-200">
                  No doctors available right now.
                </p>
              )}
              <select
                value={form.doctor_id}
                onChange={(e) =>
                  setForm({ ...form, doctor_id: e.target.value })
                }
                className="input-field"
                required
                disabled={doctors.length === 0}
              >
                <option value="">Select a doctor</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} - {d.specialization}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                Date &amp; Time
              </label>
              <DatePicker
                selected={form.appointment_date}
                onChange={(date) =>
                  setForm({ ...form, appointment_date: date })
                }
                showTimeSelect
                placeholderText="Pick date & time"
                required
                minDate={new Date()}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="flex-1 btn-primary"
                disabled={doctors.length === 0}
              >
                {isAdmin ? "Create" : "Send Request"}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ──────── Reschedule Modal ──────── */}
      {showReschedule && (
        <Modal
          title="Reschedule Appointment"
          onClose={() => setShowReschedule(null)}
        >
          <div className="mb-4 text-sm text-slate-300 space-y-1">
            <p>
              <span className="font-medium text-slate-200">Current date:</span>{" "}
              {format(
                new Date(showReschedule.appointment_date),
                "MMM d, yyyy 'at' h:mm a",
              )}
            </p>
            <p>
              <span className="font-medium text-slate-200">Doctor:</span>{" "}
              {showReschedule.doctor_name}
            </p>
            <p>
              <span className="font-medium text-slate-200">Patient:</span>{" "}
              {showReschedule.patient_name}
            </p>
          </div>
          <form onSubmit={handleReschedule} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                New Date &amp; Time
              </label>
              <DatePicker
                selected={rescheduleDate}
                onChange={(date) => setRescheduleDate(date)}
                showTimeSelect
                placeholderText="Pick new date & time"
                required
                minDate={new Date()}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 btn-primary">
                Reschedule
              </button>
              <button
                type="button"
                onClick={() => setShowReschedule(null)}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ──────── Detail Modal ──────── */}
      {showDetail && (
        <Modal title="Appointment Details" onClose={() => setShowDetail(null)}>
          <div className="space-y-4">
            {/* status badge */}
            <div className="flex items-center gap-3">
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${getStatusColor(showDetail.status)}`}
              >
                {showDetail.status}
              </span>
              <span className="text-xs text-slate-500">
                ID: {showDetail.id}
              </span>
            </div>

            {/* info grid */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500 block">Date & Time</span>
                <span className="text-slate-100 font-medium">
                  {format(
                    new Date(showDetail.appointment_date),
                    "MMM d, yyyy 'at' h:mm a",
                  )}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Created</span>
                <span className="text-slate-100 font-medium">
                  {format(new Date(showDetail.created_at), "MMM d, yyyy")}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Doctor</span>
                <span className="text-slate-100 font-medium">
                  {showDetail.doctor_name}
                </span>
                {showDetail.specialization && (
                  <span className="text-slate-400 text-xs block">
                    {showDetail.specialization}
                  </span>
                )}
                {showDetail.doctor_email && (
                  <span className="text-slate-400 text-xs block">
                    {showDetail.doctor_email}
                  </span>
                )}
              </div>
              <div>
                <span className="text-slate-500 block">Patient</span>
                <span className="text-slate-100 font-medium">
                  {showDetail.patient_name}
                </span>
                {showDetail.patient_email && (
                  <span className="text-slate-400 text-xs block">
                    {showDetail.patient_email}
                  </span>
                )}
              </div>
            </div>

            {/* detail-modal actions */}
            <div className="flex gap-2 pt-3 border-t border-slate-800 flex-wrap">
              {canApprove(showDetail) && (
                <button
                  onClick={() => {
                    handleApprove(showDetail.id);
                    setShowDetail(null);
                  }}
                  className="btn-primary text-sm flex items-center gap-1"
                >
                  <Check className="h-4 w-4" /> Approve
                </button>
              )}
              {canComplete(showDetail) && (
                <button
                  onClick={() => {
                    handleComplete(showDetail.id);
                    setShowDetail(null);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-1"
                >
                  <CheckCircle className="h-4 w-4" /> Complete
                </button>
              )}
              {canReschedule(showDetail) && (
                <button
                  onClick={() => {
                    setShowReschedule(showDetail);
                    setRescheduleDate(null);
                    setShowDetail(null);
                  }}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-1"
                >
                  <CalendarClock className="h-4 w-4" /> Reschedule
                </button>
              )}
              {canCancel(showDetail) && (
                <button
                  onClick={() => {
                    handleCancel(showDetail.id);
                    setShowDetail(null);
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-1"
                >
                  <X className="h-4 w-4" /> Cancel
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => handleDelete(showDetail.id)}
                  className="bg-red-900 hover:bg-red-800 text-red-200 px-4 py-2 rounded-lg text-sm flex items-center gap-1 ml-auto"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AppointmentsPage;
