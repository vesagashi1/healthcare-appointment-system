import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { Calendar, Users, Stethoscope, FileText, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import styles from './Dashboard.module.css';

interface DashboardStats {
  appointments: number;
  patients: number;
  doctors: number;
  records: number;
}

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    appointments: 0,
    patients: 0,
    doctors: 0,
    records: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [appointmentsRes, patientsRes, doctorsRes, recordsRes] = await Promise.allSettled([
          api.get('/appointments/my-appointments/list'),
          api.get('/patients'),
          api.get('/doctors'),
          api.get('/patients/my-profile/records'),
        ]);

        setStats({
          appointments:
            appointmentsRes.status === 'fulfilled' ? appointmentsRes.value.data.count || 0 : 0,
          patients: patientsRes.status === 'fulfilled' ? patientsRes.value.data.count || 0 : 0,
          doctors: doctorsRes.status === 'fulfilled' ? doctorsRes.value.data.count || 0 : 0,
          records: recordsRes.status === 'fulfilled' ? recordsRes.value.data.count || 0 : 0,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      name: 'My Appointments',
      value: stats.appointments,
      icon: Calendar,
      color: 'statIconBlue',
      href: '/appointments',
    },
    {
      name: 'Patients',
      value: stats.patients,
      icon: Users,
      color: 'statIconGreen',
      href: '/patients',
    },
    {
      name: 'Doctors',
      value: stats.doctors,
      icon: Stethoscope,
      color: 'statIconPurple',
      href: '/doctors',
    },
    {
      name: 'Records',
      value: stats.records,
      icon: FileText,
      color: 'statIconOrange',
      href: '/records',
    },
  ];

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Welcome back, {user?.name}!</h1>
        <p className={styles.subtitle}>Role: {user?.role}</p>
      </div>

      <div className={styles.statsGrid}>
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.name} to={card.href} className={styles.statCard}>
              <div className={styles.statHeader}>
                <div className={`${styles.statIcon} ${styles[card.color]}`}>
                  <Icon size={24} />
                </div>
                <div>
                  <p className={styles.statLabel}>{card.name}</p>
                  <p className={styles.statValue}>{card.value}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className={styles.actionsGrid}>
        <div className={styles.actionCard}>
          <h2 className={styles.actionTitle}>Quick Actions</h2>
          <div className={styles.actionList}>
            <Link to="/appointments" className={styles.actionItem}>
              <Calendar className={styles.actionIcon} />
              <span>Book Appointment</span>
            </Link>
            <Link to="/export-import" className={styles.actionItem}>
              <TrendingUp className={styles.actionIcon} />
              <span>Export/Import Data</span>
            </Link>
            {user?.role === 'admin' && (
              <Link to="/admin" className={styles.actionItem}>
                <FileText className={styles.actionIcon} />
                <span>Admin Panel</span>
              </Link>
            )}
          </div>
        </div>

        <div className={styles.infoCard}>
          <h2 className={styles.infoTitle}>System Information</h2>
          <div className={styles.infoList}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>User Role:</span>
              <span className={styles.infoValue}>{user?.role}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Email:</span>
              <span className={styles.infoValue}>{user?.email}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
