import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../shared/auth/AuthContext";
import { doctorApi } from "../../shared/api/doctorApi";
import type { DashboardData } from "../../shared/api/doctorApi";
import styles from "./DoctorDashboard.module.css";

export function DoctorDashboardPage() {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      if (!token) return;

      try {
        setLoading(true);
        const data = await doctorApi.getDashboard(token);
        setDashboardData(data);
        setError(null);
      } catch (err: unknown) {
        console.error("Failed to fetch dashboard:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load dashboard",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [token]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return styles.statusPending;
      case "approved":
        return styles.statusApproved;
      case "completed":
        return styles.statusCompleted;
      case "cancelled":
        return styles.statusCancelled;
      default:
        return styles.statusDefault;
    }
  };

  return (
    <div className={styles.page}>
      <nav className={styles.navbar}>
        <div className={styles.navContainer}>
          <div className={styles.navBrand}>Healthcare System</div>
          <div className={styles.navLinks}>
            <Link to="/doctor/dashboard" className={styles.navLinkActive}>
              Dashboard
            </Link>
            <Link to="/doctor/appointments" className={styles.navLink}>
              My Appointments
            </Link>
            <Link to="/doctor/patients" className={styles.navLink}>
              My Patients
            </Link>
          </div>
          <div className={styles.navActions}>
            <div className={styles.userInfo}>
              <div className={styles.userAvatar}>
                {user?.name?.[0]?.toUpperCase() || "D"}
              </div>
              <span className={styles.userName}>{user?.name}</span>
            </div>
            <button onClick={logout} className={styles.logoutBtn}>
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.header}>
            <div>
              <h1 className={styles.title}>Welcome back, Dr. {user?.name}</h1>
              <p className={styles.subtitle}>Here's what's happening today</p>
            </div>
          </div>

          {loading && (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
              <p>Loading dashboard...</p>
            </div>
          )}

          {error && (
            <div className={styles.error}>
              <p>{error}</p>
              <button
                onClick={() => window.location.reload()}
                className={styles.retryBtn}
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && dashboardData && (
            <>
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <div
                    className={styles.statIcon}
                    style={{
                      background:
                        "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    }}
                  >
                    <svg
                      width="24"
                      height="24"
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
                  </div>
                  <div className={styles.statContent}>
                    <p className={styles.statLabel}>Total Patients</p>
                    <p className={styles.statValue}>
                      {dashboardData.stats.totalPatients}
                    </p>
                  </div>
                </div>

                <div className={styles.statCard}>
                  <div
                    className={styles.statIcon}
                    style={{
                      background:
                        "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                    }}
                  >
                    <svg
                      width="24"
                      height="24"
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
                  </div>
                  <div className={styles.statContent}>
                    <p className={styles.statLabel}>Pending Appointments</p>
                    <p className={styles.statValue}>
                      {dashboardData.stats.pendingAppointments}
                    </p>
                  </div>
                </div>

                <div className={styles.statCard}>
                  <div
                    className={styles.statIcon}
                    style={{
                      background:
                        "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
                    }}
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                  </div>
                  <div className={styles.statContent}>
                    <p className={styles.statLabel}>Records (30 days)</p>
                    <p className={styles.statValue}>
                      {dashboardData.stats.recentRecords}
                    </p>
                  </div>
                </div>

                <div className={styles.statCard}>
                  <div
                    className={styles.statIcon}
                    style={{
                      background:
                        "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
                    }}
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                  </div>
                  <div className={styles.statContent}>
                    <p className={styles.statLabel}>Total Appointments</p>
                    <p className={styles.statValue}>
                      {dashboardData.stats.totalAppointments}
                    </p>
                  </div>
                </div>
              </div>

              <div className={styles.contentGrid}>
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>
                      Today's Appointments
                    </h2>
                    <Link
                      to="/doctor/appointments"
                      className={styles.viewAllLink}
                    >
                      View All →
                    </Link>
                  </div>
                  <div className={styles.card}>
                    {dashboardData.todayAppointments.length === 0 ? (
                      <div className={styles.emptyState}>
                        <svg
                          width="48"
                          height="48"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <rect
                            x="3"
                            y="4"
                            width="18"
                            height="18"
                            rx="2"
                            ry="2"
                          />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <p>No appointments scheduled for today</p>
                      </div>
                    ) : (
                      <div className={styles.appointmentList}>
                        {dashboardData.todayAppointments.map((apt) => (
                          <div key={apt.id} className={styles.appointmentItem}>
                            <div className={styles.appointmentTime}>
                              {formatDate(apt.appointment_date)}
                            </div>
                            <div className={styles.appointmentDetails}>
                              <p className={styles.patientName}>
                                {apt.patient_name}
                              </p>
                              <span
                                className={`${styles.statusBadge} ${getStatusBadgeClass(apt.status)}`}
                              >
                                {apt.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>Recent Activity</h2>
                  </div>
                  <div className={styles.card}>
                    {dashboardData.recentActivity.length === 0 ? (
                      <div className={styles.emptyState}>
                        <svg
                          width="48"
                          height="48"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                        </svg>
                        <p>No recent activity</p>
                      </div>
                    ) : (
                      <div className={styles.activityList}>
                        {dashboardData.recentActivity.map((activity) => (
                          <div
                            key={activity.id}
                            className={styles.activityItem}
                          >
                            <div className={styles.activityIcon}>
                              <div className={styles.activityDot}></div>
                            </div>
                            <div className={styles.activityContent}>
                              <p className={styles.activityText}>
                                Appointment with{" "}
                                <strong>{activity.patient_name}</strong>
                              </p>
                              <div className={styles.activityMeta}>
                                <span
                                  className={`${styles.statusBadge} ${getStatusBadgeClass(activity.status)}`}
                                >
                                  {activity.status}
                                </span>
                                <span className={styles.activityTime}>
                                  {formatDate(activity.created_at)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className={styles.quickActions}>
                <h2 className={styles.sectionTitle}>Quick Actions</h2>
                <div className={styles.actionsGrid}>
                  <button
                    onClick={() => navigate("/doctor/appointments")}
                    className={styles.actionCard}
                  >
                    <svg
                      width="24"
                      height="24"
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
                    <span>View All Appointments</span>
                  </button>
                  <button
                    onClick={() => navigate("/doctor/patients")}
                    className={styles.actionCard}
                  >
                    <svg
                      width="24"
                      height="24"
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
                    <span>View My Patients</span>
                  </button>
                  <button
                    onClick={() => navigate("/doctor/patient-records")}
                    className={styles.actionCard}
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                    <span>Create Medical Record</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
