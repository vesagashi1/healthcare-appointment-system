import { Link } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthContext';

export function DoctorDashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div style={{ maxWidth: 900, margin: '32px auto', padding: 16 }}>
      <h2>Doctor Dashboard</h2>
      <p>
        Signed in as <b>{user?.role}</b> (user #{user?.id})
      </p>
      <p>
        <button onClick={logout}>Logout</button>
      </p>

      <ul>
        <li>
          <Link to="/doctor/patient-records">Patient records (by patient ID)</Link>
        </li>
        <li>
          <Link to="/doctor/approve-appointment">Approve appointment (by appointment ID)</Link>
        </li>
      </ul>
    </div>
  );
}
