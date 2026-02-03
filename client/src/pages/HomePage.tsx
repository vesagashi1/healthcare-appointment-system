import { Link } from 'react-router-dom';
import { useAuth } from '../shared/auth/AuthContext';

export function HomePage() {
  const { user, logout } = useAuth();

  return (
    <div style={{ maxWidth: 900, margin: '32px auto', padding: 16 }}>
      <h1>Healthcare Appointment System</h1>

      {!user ? (
        <p>
          <Link to="/login">Login</Link> or <Link to="/register">Register</Link>
        </p>
      ) : (
        <>
          <p>
            Signed in as <b>{user.role}</b> (user #{user.id})
          </p>
          <p>
            <button onClick={logout}>Logout</button>
          </p>
          {user.role === 'doctor' && (
            <p>
              <Link to="/doctor">Go to Doctor Dashboard</Link>
            </p>
          )}
        </>
      )}

      <hr />
      <p>
        Backend health check: <a href="/api/test/protected">/api/test/protected</a> (requires token)
      </p>
    </div>
  );
}
