import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Settings, Users, FileText, Shield, Filter, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import styles from './AdminPage.module.css';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface User {
  id: number;
  name: string;
  email: string;
  role?: string;
  roles?: string;
  created_at: string;
}

interface AuditLog {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  role: string;
  action: string;
  patient_id: number | null;
  ip_address: string | null;
  created_at: string;
}

interface UserFormState {
  name: string;
  email: string;
  role: string;
  password: string;
}

const AdminPage = () => {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const canAccessAdmin =
    user?.role === 'admin' ||
    (Array.isArray(user?.permissions) &&
      (user.permissions.includes('VIEW_USERS') || user.permissions.includes('MANAGE_USERS')));
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'logs'>('users');
  const [loading, setLoading] = useState(true);
  const [submittingUser, setSubmittingUser] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState<UserFormState>({
    name: '',
    email: '',
    role: 'patient',
    password: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    action: '',
    user_id: '',
    start_date: '',
    end_date: '',
  });

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    } else {
      fetchAuditLogs();
    }
  }, [activeTab, filters]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/users');
      setUsers(response.data.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.action) params.append('action', filters.action);
      if (filters.user_id) params.append('user_id', filters.user_id);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      params.append('limit', '100');

      const response = await api.get(`/admin/audit-logs?${params.toString()}`);
      setAuditLogs(response.data.logs || []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast.error('Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  const openCreateUser = () => {
    setEditingUser(null);
    setUserForm({
      name: '',
      email: '',
      role: 'patient',
      password: '',
    });
    setShowUserModal(true);
  };

  const openEditUser = (targetUser: User) => {
    const primaryRole = (targetUser.roles || targetUser.role || 'patient').split(',')[0].trim();
    setEditingUser(targetUser);
    setUserForm({
      name: targetUser.name,
      email: targetUser.email,
      role: primaryRole || 'patient',
      password: '',
    });
    setShowUserModal(true);
  };

  const closeUserModal = () => {
    if (submittingUser) return;
    setShowUserModal(false);
    setEditingUser(null);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.name.trim() || !userForm.email.trim() || !userForm.role.trim()) {
      toast.error('Name, email and role are required');
      return;
    }
    if (!editingUser && userForm.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setSubmittingUser(true);
    try {
      if (editingUser) {
        await api.patch(`/admin/users/${editingUser.id}`, {
          name: userForm.name.trim(),
          email: userForm.email.trim(),
          role: userForm.role,
        });
        toast.success('User updated successfully');
      } else {
        await api.post('/admin/users', {
          name: userForm.name.trim(),
          email: userForm.email.trim(),
          password: userForm.password,
          role: userForm.role,
        });
        toast.success('User created successfully');
      }
      closeUserModal();
      await fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save user');
    } finally {
      setSubmittingUser(false);
    }
  };

  const handleDeleteUser = async (targetUser: User) => {
    if (targetUser.id === user?.id) {
      toast.error('You cannot delete your own account');
      return;
    }

    const confirmed = window.confirm(`Delete user "${targetUser.name}"?`);
    if (!confirmed) return;

    try {
      await api.delete(`/admin/users/${targetUser.id}`);
      toast.success('User deleted successfully');
      await fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete user');
    }
  };

  const getRoleColor = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return styles.roleAdmin;
      case 'doctor':
        return styles.roleDoctor;
      case 'nurse':
        return styles.roleNurse;
      case 'patient':
        return styles.rolePatient;
      case 'caregiver':
        return styles.roleCaregiver;
      default:
        return styles.roleDefault;
    }
  };

  const getActionColor = (action: string) => {
    if (action.includes('CREATE')) return styles.actionCreate;
    if (action.includes('UPDATE') || action.includes('CORRECT')) return styles.actionUpdate;
    if (action.includes('DELETE') || action.includes('VOID')) return styles.actionDelete;
    if (action.includes('VIEW')) return styles.actionView;
    return styles.actionDefault;
  };

  const clearFilters = () => {
    setFilters({
      action: '',
      user_id: '',
      start_date: '',
      end_date: '',
    });
  };

  const handleActionClick = (log: AuditLog) => {
    if (log.action.includes('PATIENT') && (log.action.includes('RECORD') || log.action.includes('VIEW'))) {
      navigate('/records');
    }
  };

  if (!canAccessAdmin) {
    return (
      <div className={styles.emptyState}>
        <Shield className={styles.emptyIcon} />
        <p className={styles.emptyText}>Admin access required.</p>
      </div>
    );
  }

  if (loading && activeTab === 'users' && users.length === 0) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Settings className={styles.headerIcon} />
          <h1 className={styles.title}>Admin Panel</h1>
        </div>
        {activeTab === 'users' && (
          <button className={styles.primaryBtn} onClick={openCreateUser}>
            Create User
          </button>
        )}
      </div>

      <div className={styles.tabs}>
        <button
          onClick={() => setActiveTab('users')}
          className={`${styles.tab} ${activeTab === 'users' ? styles.tabActive : ''}`}
        >
          <Users className={styles.tabIcon} />
          Users ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`${styles.tab} ${activeTab === 'logs' ? styles.tabActive : ''}`}
        >
          <FileText className={styles.tabIcon} />
          Audit Logs ({auditLogs.length})
        </button>
      </div>

      {activeTab === 'users' && (
        <div className={styles.tabContent}>
          {users.length === 0 ? (
            <div className={styles.emptyState}>
              <Users className={styles.emptyIcon} />
              <p className={styles.emptyText}>No users found</p>
            </div>
          ) : (
            <div className={styles.tableCard}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((rowUser) => (
                    <tr key={rowUser.id}>
                      <td>
                        <div className={styles.userInfo}>
                          <div className={styles.userName}>{rowUser.name}</div>
                          <div className={styles.userEmail}>{rowUser.email}</div>
                        </div>
                      </td>
                      <td>
                        <span className={`${styles.roleBadge} ${getRoleColor(rowUser.roles || rowUser.role || '')}`}>
                          {rowUser.roles || rowUser.role || 'unknown'}
                        </span>
                      </td>
                      <td className={styles.date}>
                        {format(new Date(rowUser.created_at), 'PP')}
                      </td>
                      <td>
                        <div className={styles.actionButtons}>
                          <button
                            className={styles.rowActionBtn}
                            onClick={() => openEditUser(rowUser)}
                          >
                            Edit
                          </button>
                          <button
                            className={`${styles.rowActionBtn} ${styles.rowActionDanger}`}
                            onClick={() => handleDeleteUser(rowUser)}
                            disabled={rowUser.id === user?.id}
                          >
                            Delete
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

      {activeTab === 'logs' && (
        <div className={styles.tabContent}>
          <div className={styles.filtersSection}>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={styles.filterToggle}
            >
              <Filter className={styles.filterIcon} />
              Filters
            </button>
            {showFilters && (
              <div className={styles.filters}>
                <div className={styles.filterRow}>
                  <div className={styles.filterField}>
                    <label className={styles.filterLabel}>Action</label>
                    <input
                      type="text"
                      className={styles.filterInput}
                      placeholder="e.g. CREATE_PATIENT_RECORD"
                      value={filters.action}
                      onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                    />
                  </div>
                  <div className={styles.filterField}>
                    <label className={styles.filterLabel}>User ID</label>
                    <input
                      type="number"
                      className={styles.filterInput}
                      placeholder="User ID"
                      value={filters.user_id}
                      onChange={(e) => setFilters({ ...filters, user_id: e.target.value })}
                    />
                  </div>
                </div>
                <div className={styles.filterRow}>
                  <div className={styles.filterField}>
                    <label className={styles.filterLabel}>Start Date</label>
                    <input
                      type="date"
                      className={styles.filterInput}
                      value={filters.start_date}
                      onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                    />
                  </div>
                  <div className={styles.filterField}>
                    <label className={styles.filterLabel}>End Date</label>
                    <input
                      type="date"
                      className={styles.filterInput}
                      value={filters.end_date}
                      onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                    />
                  </div>
                </div>
                <button onClick={clearFilters} className={styles.clearFiltersBtn}>
                  Clear Filters
                </button>
              </div>
            )}
          </div>

          {loading && auditLogs.length === 0 ? (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className={styles.emptyState}>
              <FileText className={styles.emptyIcon} />
              <p className={styles.emptyText}>No audit logs found</p>
            </div>
          ) : (
            <div className={styles.logsList}>
              {auditLogs.map((log) => (
                <div key={log.id} className={styles.logCard}>
                  <div className={styles.logHeader}>
                    <div className={styles.logHeaderLeft}>
                      <Shield className={styles.logIcon} />
                      <div className={styles.logUserInfo}>
                        <span className={styles.logUserName}>{log.user_name || 'Unknown'}</span>
                        <span className={styles.logUserEmail}>{log.user_email}</span>
                      </div>
                      <span className={`${styles.roleBadge} ${getRoleColor(log.role)}`}>
                        {log.role}
                      </span>
                    </div>
                    <div className={styles.logDate}>
                      <Calendar className={styles.dateIcon} />
                      {format(new Date(log.created_at), 'PPp')}
                    </div>
                  </div>
                  <div className={styles.logBody}>
                    <div className={styles.logActionRow}>
                      <span 
                        className={`${styles.actionBadge} ${getActionColor(log.action)} ${log.action.includes('PATIENT') && (log.action.includes('RECORD') || log.action.includes('VIEW')) ? styles.actionClickable : ''}`}
                        onClick={() => handleActionClick(log)}
                        style={log.action.includes('PATIENT') && (log.action.includes('RECORD') || log.action.includes('VIEW')) ? { cursor: 'pointer' } : {}}
                      >
                        {log.action.replace(/_/g, ' ')}
                      </span>
                      {log.patient_id && (
                        <span className={styles.patientId}>Patient ID: {log.patient_id}</span>
                      )}
                      {log.ip_address && (
                        <span className={styles.ipAddress}>IP: {log.ip_address}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showUserModal && (
        <div className={styles.modalOverlay} onClick={closeUserModal}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>{editingUser ? 'Edit User' : 'Create User'}</h2>
            <form onSubmit={handleSaveUser} className={styles.modalForm}>
              <div className={styles.filterField}>
                <label className={styles.filterLabel}>Name</label>
                <input
                  className={styles.filterInput}
                  value={userForm.name}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div className={styles.filterField}>
                <label className={styles.filterLabel}>Email</label>
                <input
                  type="email"
                  className={styles.filterInput}
                  value={userForm.email}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>
              <div className={styles.filterField}>
                <label className={styles.filterLabel}>Role</label>
                <select
                  className={styles.filterInput}
                  value={userForm.role}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, role: e.target.value }))}
                >
                  <option value="admin">admin</option>
                  <option value="doctor">doctor</option>
                  <option value="nurse">nurse</option>
                  <option value="patient">patient</option>
                  <option value="caregiver">caregiver</option>
                </select>
              </div>
              {!editingUser && (
                <div className={styles.filterField}>
                  <label className={styles.filterLabel}>Password</label>
                  <input
                    type="password"
                    className={styles.filterInput}
                    value={userForm.password}
                    onChange={(e) => setUserForm((prev) => ({ ...prev, password: e.target.value }))}
                    minLength={8}
                    required
                  />
                </div>
              )}
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={closeUserModal}
                  disabled={submittingUser}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.primaryBtn} disabled={submittingUser}>
                  {submittingUser ? 'Saving...' : editingUser ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;
