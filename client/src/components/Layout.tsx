import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Calendar,
  Users,
  Stethoscope,
  FileText,
  Download,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  Check,
} from 'lucide-react';
import styles from './Layout.module.css';
import { getAccessToken } from '../services/api';
import { NotificationItem, notificationService } from '../services/notificationService';
import { formatDistanceToNow } from 'date-fns';

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const unreadLabel = useMemo(() => {
    if (unreadCount > 99) return '99+';
    return unreadCount.toString();
  }, [unreadCount]);

  const hasPermission = (permissionName: string) =>
    Array.isArray(user?.permissions) && user.permissions.includes(permissionName);

  const canSeeCaregiverPatientsNav =
    user?.role === 'caregiver' && (!Array.isArray(user?.permissions) || hasPermission('VIEW_PATIENT_RECORD'));

  const canSeeCaregiversNav =
    user?.role === 'admin' || hasPermission('MANAGE_USERS');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const loadNotifications = async () => {
    if (!user) return;
    try {
      setLoadingNotifications(true);
      const [list, unread] = await Promise.all([
        notificationService.list(20, 0),
        notificationService.unreadCount(),
      ]);
      setNotifications(list);
      setUnreadCount(unread);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await notificationService.markRead(id);
      setNotifications((current) =>
        current.map((item) => (item._id === id ? { ...item, read: true } : item))
      );
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllRead();
      setNotifications((current) => current.map((item) => ({ ...item, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadNotifications();

    const token = getAccessToken();
    if (!token) return;

    const socket = notificationService.connectSocket(token);
    socket.on('notification:new', (notification: NotificationItem) => {
      setNotifications((current) => {
        if (current.some((n) => n._id === notification._id)) return current;
        return [notification, ...current].slice(0, 20);
      });
      if (!notification.read) {
        setUnreadCount((current) => current + 1);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Appointments', href: '/appointments', icon: Calendar },
    ...(canSeeCaregiverPatientsNav
      ? [{ name: 'My Patients', href: '/caregiver/patients', icon: Users }]
      : [{ name: 'Patients', href: '/patients', icon: Users }]),
    ...(canSeeCaregiversNav ? [{ name: 'Caregivers', href: '/caregivers', icon: Users }] : []),
    { name: 'Doctors', href: '/doctors', icon: Stethoscope },
    { name: 'Records', href: '/records', icon: FileText },
    { name: 'Export/Import', href: '/export-import', icon: Download },
  ];

  if (user?.role === 'admin') {
    navigation.push({ name: 'Admin', href: '/admin', icon: Settings });
  }

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className={styles.layout}>
      {/* Desktop Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logo}>🏥 Healthcare</div>
        </div>
        <nav className={styles.nav}>
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`${styles.navItem} ${isActive(item.href) ? styles.navItemActive : ''}`}
              >
                <Icon className={styles.navIcon} />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className={styles.userSection}>
          <div className={styles.userInfo}>
            <div className={styles.userAvatar}>
              {user?.role.charAt(0).toUpperCase()}
            </div>
            <div className={styles.userDetails}>
              <div className={styles.userName}>{user?.name}</div>
              <div className={styles.userRole}>{user?.role}</div>
            </div>
          </div>
          <button onClick={handleLogout} className={styles.logoutBtn}>
            <LogOut className={styles.navIcon} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className={styles.mobileHeader}>
        <div className={styles.logo}>🏥 Healthcare</div>
        <div className={styles.mobileHeaderActions}>
          <button
            onClick={() => setNotificationsOpen((open) => !open)}
            className={styles.notificationBtn}
            aria-label="Open notifications"
          >
            <Bell size={20} />
            {unreadCount > 0 && <span className={styles.notificationBadge}>{unreadLabel}</span>}
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{ background: 'none', border: 'none', color: 'rgba(226, 232, 240, 0.9)', cursor: 'pointer' }}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className={styles.mobileMenu}>
          <nav className={styles.mobileNav}>
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`${styles.navItem} ${isActive(item.href) ? styles.navItemActive : ''}`}
                >
                  <Icon className={styles.navIcon} />
                  {item.name}
                </Link>
              );
            })}
            <button onClick={handleLogout} className={styles.logoutBtn}>
              <LogOut className={styles.navIcon} />
              Sign out
            </button>
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className={styles.main}>
        <div className={styles.notificationAnchor}>
          <button
            onClick={() => setNotificationsOpen((open) => !open)}
            className={styles.notificationBtn}
            aria-label="Open notifications"
          >
            <Bell size={20} />
            {unreadCount > 0 && <span className={styles.notificationBadge}>{unreadLabel}</span>}
          </button>
        </div>

        {notificationsOpen && (
          <div className={styles.notificationsPanel}>
            <div className={styles.notificationsHeader}>
              <strong>Notifications</strong>
              <button onClick={handleMarkAllRead} className={styles.markAllBtn} type="button">
                Mark all read
              </button>
            </div>

            {loadingNotifications ? (
              <div className={styles.notificationsEmpty}>Loading...</div>
            ) : notifications.length === 0 ? (
              <div className={styles.notificationsEmpty}>No notifications yet</div>
            ) : (
              <div className={styles.notificationsList}>
                {notifications.map((item) => (
                  <div
                    key={item._id}
                    className={`${styles.notificationItem} ${item.read ? styles.notificationRead : styles.notificationUnread}`}
                  >
                    <div className={styles.notificationTopRow}>
                      <span className={styles.notificationTitle}>{item.title}</span>
                      {!item.read && (
                        <button
                          type="button"
                          className={styles.notificationReadBtn}
                          onClick={() => handleMarkRead(item._id)}
                        >
                          <Check size={14} />
                        </button>
                      )}
                    </div>
                    <p className={styles.notificationMessage}>{item.message}</p>
                    <span className={styles.notificationTime}>
                      {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className={styles.content}>{children}</div>
      </main>
    </div>
  );
};

export default Layout;
