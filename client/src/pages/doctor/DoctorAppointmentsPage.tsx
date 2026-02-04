import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { HttpError } from "../../shared/api/http";
import {
  approveAppointment,
  cancelAppointment,
  listAppointments,
  type AppointmentListItem,
  type AppointmentStatus,
} from "../../shared/api/appointmentApi";
import { useAuth } from "../../shared/auth/AuthContext";
import shell from "./DoctorDashboard.module.css";
import styles from "./DoctorAppointmentsPage.module.css";

type Filters = {
  status: AppointmentStatus | "";
  start_date: string;
  end_date: string;
  q: string;
};

const STATUS_OPTIONS: Array<{ value: Filters["status"]; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "scheduled", label: "Scheduled" },
  { value: "approved", label: "Approved" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No show" },
];

export function DoctorAppointmentsPage() {
  const { user, logout, token } = useAuth();

  const [items, setItems] = useState<AppointmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<Filters>({
    status: "",
    start_date: "",
    end_date: "",
    q: "",
  });

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const res = await listAppointments(token, {
        status: filters.status || undefined,
        start_date: filters.start_date || undefined,
        end_date: filters.end_date || undefined,
      });

      setItems(res.appointments);
    } catch (err) {
      if (err instanceof HttpError) setError(err.message);
      else setError("Failed to load appointments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredItems = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    if (!q) return items;
    return items.filter((a) => {
      return (
        a.patient_name.toLowerCase().includes(q) ||
        a.patient_email.toLowerCase().includes(q) ||
        String(a.id).includes(q)
      );
    });
  }, [items, filters.q]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusClass = (status: string) => {
    switch (status.toLowerCase()) {
      case "scheduled":
        return shell.statusPending;
      case "approved":
        return shell.statusApproved;
      case "completed":
        return shell.statusCompleted;
      case "cancelled":
        return shell.statusCancelled;
      default:
        return shell.statusDefault;
    }
  };

  const onApprove = async (id: number) => {
    if (!token) return;
    setBusyId(id);
    setError(null);
    try {
      await approveAppointment(token, id);
      await load();
    } catch (err) {
      if (err instanceof HttpError) setError(err.message);
      else setError("Failed to approve appointment");
    } finally {
      setBusyId(null);
    }
  };

  const onCancel = async (id: number) => {
    if (!token) return;
    setBusyId(id);
    setError(null);
    try {
      await cancelAppointment(token, id);
      await load();
    } catch (err) {
      if (err instanceof HttpError) setError(err.message);
      else setError("Failed to cancel appointment");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className={shell.page}>
      <nav className={shell.navbar}>
        <div className={shell.navContainer}>
          <div className={shell.navBrand}>Healthcare System</div>
          <div className={shell.navLinks}>
            <Link to="/doctor" className={shell.navLink}>
              Dashboard
            </Link>
            <Link to="/doctor/appointments" className={shell.navLinkActive}>
              My Appointments
            </Link>
            <Link to="/doctor/patients" className={shell.navLink}>
              My Patients
            </Link>
          </div>
          <div className={shell.navActions}>
            <div className={shell.userInfo}>
              <div className={shell.userAvatar}>
                {user?.name?.[0]?.toUpperCase() || "D"}
              </div>
              <span className={shell.userName}>{user?.name}</span>
            </div>
            <button onClick={logout} className={shell.logoutBtn}>
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className={shell.main}>
        <div className={shell.container}>
          <div className={styles.headerRow}>
            <div>
              <h1 className={shell.title}>My Appointments</h1>
              <p className={shell.subtitle}>
                Review, approve, and manage your schedule
              </p>
            </div>
            <button
              className={styles.refreshBtn}
              onClick={load}
              disabled={loading}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          <div className={styles.filtersCard}>
            <div className={styles.filtersGrid}>
              <label className={styles.field}>
                <span>Status</span>
                <select
                  value={filters.status}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      status: e.target.value as Filters["status"],
                    }))
                  }
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value || "all"} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.field}>
                <span>Start date</span>
                <input
                  type="date"
                  value={filters.start_date}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, start_date: e.target.value }))
                  }
                />
              </label>

              <label className={styles.field}>
                <span>End date</span>
                <input
                  type="date"
                  value={filters.end_date}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, end_date: e.target.value }))
                  }
                />
              </label>

              <label className={styles.field}>
                <span>Search</span>
                <input
                  placeholder="Patient name, email, or appointment ID"
                  value={filters.q}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, q: e.target.value }))
                  }
                />
              </label>

              <div className={styles.actionsRow}>
                <button
                  className={styles.applyBtn}
                  onClick={load}
                  disabled={loading}
                >
                  Apply filters
                </button>
                <button
                  className={styles.clearBtn}
                  onClick={() => {
                    setFilters({
                      status: "",
                      start_date: "",
                      end_date: "",
                      q: "",
                    });
                    // reload without filters
                    setTimeout(() => void load(), 0);
                  }}
                  disabled={loading}
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className={shell.error}>
              <p>{error}</p>
              <button onClick={load} className={shell.retryBtn}>
                Retry
              </button>
            </div>
          )}

          {!error && loading && (
            <div className={shell.loading}>
              <div className={shell.spinner}></div>
              <p>Loading appointments…</p>
            </div>
          )}

          {!error && !loading && (
            <div className={styles.tableCard}>
              <div className={styles.tableHeader}>
                <div className={styles.tableTitle}>
                  Appointments{" "}
                  <span className={styles.count}>({filteredItems.length})</span>
                </div>
              </div>

              {filteredItems.length === 0 ? (
                <div className={shell.emptyState}>
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <p>No appointments match your filters</p>
                </div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Patient</th>
                        <th>Date &amp; Time</th>
                        <th>Status</th>
                        <th style={{ textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map((a) => {
                        const approving = busyId === a.id;
                        const canApprove = a.status === "scheduled";
                        const canCancel =
                          a.status === "scheduled" || a.status === "approved";
                        return (
                          <tr key={a.id}>
                            <td>
                              <div className={styles.patientCell}>
                                <div className={styles.patientName}>
                                  {a.patient_name}
                                </div>
                                <div className={styles.patientMeta}>
                                  {a.patient_email}
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className={styles.dateCell}>
                                <div className={styles.dateMain}>
                                  {formatDate(a.appointment_date)}
                                </div>
                                <div className={styles.dateSub}>#{a.id}</div>
                              </div>
                            </td>
                            <td>
                              <span
                                className={`${shell.statusBadge} ${getStatusClass(a.status)}`}
                              >
                                {a.status === "scheduled"
                                  ? "scheduled"
                                  : a.status}
                              </span>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <div className={styles.rowActions}>
                                <button
                                  className={styles.primaryBtn}
                                  onClick={() => onApprove(a.id)}
                                  disabled={!canApprove || approving}
                                  title={
                                    canApprove
                                      ? "Approve appointment"
                                      : "Only scheduled appointments can be approved"
                                  }
                                >
                                  {approving && canApprove
                                    ? "Approving…"
                                    : "Approve"}
                                </button>
                                <button
                                  className={styles.dangerBtn}
                                  onClick={() => onCancel(a.id)}
                                  disabled={!canCancel || approving}
                                  title={
                                    canCancel
                                      ? "Cancel appointment"
                                      : "Only scheduled/approved appointments can be cancelled"
                                  }
                                >
                                  {approving && canCancel
                                    ? "Cancelling…"
                                    : "Cancel"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
