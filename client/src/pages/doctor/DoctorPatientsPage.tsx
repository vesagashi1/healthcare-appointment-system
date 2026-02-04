import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { HttpError } from "../../shared/api/http";
import { doctorApi, type Patient } from "../../shared/api/doctorApi";
import { useAuth } from "../../shared/auth/AuthContext";
import shell from "./DoctorDashboard.module.css";
import styles from "./DoctorPatientsPage.module.css";

type SortKey = "id" | "name" | "email" | "ward";
type SortDir = "asc" | "desc";

export function DoctorPatientsPage() {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const me = await doctorApi.getMe(token);
      const res = await doctorApi.getMyPatients(token, me.doctor.id);
      setPatients(res.patients);
    } catch (err) {
      if (err instanceof HttpError) setError(err.message);
      else setError("Failed to load patients");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return patients;
    return patients.filter((p) => {
      return (
        p.name.toLowerCase().includes(needle) ||
        p.email.toLowerCase().includes(needle) ||
        p.ward_name?.toLowerCase().includes(needle) ||
        String(p.id).includes(needle)
      );
    });
  }, [patients, q]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const list = [...filtered];
    const pick = (p: Patient): string | number => {
      switch (sortKey) {
        case "id":
          return p.id;
        case "email":
          return p.email;
        case "ward":
          return p.ward_name || "";
        case "name":
        default:
          return p.name;
      }
    };

    list.sort((a, b) => {
      const av = pick(a);
      const bv = pick(b);
      if (typeof av === "number" && typeof bv === "number")
        return (av - bv) * dir;
      return (
        String(av).localeCompare(String(bv), undefined, {
          sensitivity: "base",
        }) * dir
      );
    });

    return list;
  }, [filtered, sortDir, sortKey]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const copyPatientId = async (patientId: number) => {
    try {
      await navigator.clipboard.writeText(String(patientId));
      setToast(`Copied patient ID #${patientId}`);
    } catch {
      setToast("Copy failed (clipboard unavailable)");
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
            <Link to="/doctor/appointments" className={shell.navLink}>
              My Appointments
            </Link>
            <Link to="/doctor/patients" className={shell.navLinkActive}>
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
              <h1 className={shell.title}>My Patients</h1>
              <p className={shell.subtitle}>
                Patients in your assigned wards, searchable and quick to access
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

          <div className={styles.toolsCard}>
            <label className={styles.searchField}>
              <span>Search</span>
              <input
                placeholder="Name, email, ward, or patient ID"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
            <div className={styles.meta}>
              <div>
                <div className={styles.metaLabel}>Total</div>
                <div className={styles.metaValue}>{patients.length}</div>
              </div>
              <div>
                <div className={styles.metaLabel}>Showing</div>
                <div className={styles.metaValue}>{filtered.length}</div>
              </div>
            </div>
          </div>

          {toast && <div className={styles.toast}>{toast}</div>}

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
              <p>Loading patients…</p>
            </div>
          )}

          {!error && !loading && (
            <div className={styles.tableCard}>
              <div className={styles.tableHeader}>
                <div className={styles.tableTitle}>Patients</div>
                <div className={styles.count}>{sorted.length} shown</div>
              </div>

              {sorted.length === 0 ? (
                <div className={shell.emptyState} style={{ padding: 24 }}>
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <p>No patients match your search</p>
                </div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>
                          <button
                            type="button"
                            className={styles.sortBtn}
                            onClick={() => toggleSort("id")}
                          >
                            ID
                            {sortKey === "id" && (
                              <span className={styles.sortIcon}>
                                {sortDir === "asc" ? "▲" : "▼"}
                              </span>
                            )}
                          </button>
                        </th>
                        <th>
                          <button
                            type="button"
                            className={styles.sortBtn}
                            onClick={() => toggleSort("name")}
                          >
                            Patient
                            {sortKey === "name" && (
                              <span className={styles.sortIcon}>
                                {sortDir === "asc" ? "▲" : "▼"}
                              </span>
                            )}
                          </button>
                        </th>
                        <th>
                          <button
                            type="button"
                            className={styles.sortBtn}
                            onClick={() => toggleSort("email")}
                          >
                            Email
                            {sortKey === "email" && (
                              <span className={styles.sortIcon}>
                                {sortDir === "asc" ? "▲" : "▼"}
                              </span>
                            )}
                          </button>
                        </th>
                        <th>
                          <button
                            type="button"
                            className={styles.sortBtn}
                            onClick={() => toggleSort("ward")}
                          >
                            Ward
                            {sortKey === "ward" && (
                              <span className={styles.sortIcon}>
                                {sortDir === "asc" ? "▲" : "▼"}
                              </span>
                            )}
                          </button>
                        </th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <span className={styles.idPill}>#{p.id}</span>
                          </td>
                          <td>
                            <div className={styles.patientCell}>
                              <div className={styles.patientName}>{p.name}</div>
                              <div className={styles.patientMeta}>
                                user_id: {p.user_id}
                              </div>
                            </div>
                          </td>
                          <td className={styles.mono}>{p.email}</td>
                          <td>{p.ward_name || "—"}</td>
                          <td>
                            <div className={styles.rowActions}>
                              <button
                                type="button"
                                className={styles.secondaryBtn}
                                onClick={() => void copyPatientId(p.id)}
                                title="Copy patient ID"
                              >
                                Copy ID
                              </button>
                              <button
                                type="button"
                                className={styles.primaryBtn}
                                onClick={() => {
                                  void copyPatientId(p.id);
                                  navigate("/doctor/patient-records");
                                }}
                                title="Opens the records tool (patient ID copied)"
                              >
                                Records
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
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
