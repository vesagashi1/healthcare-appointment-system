import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../shared/api/authApi';
import { HttpError } from '../shared/api/http';
import { useAuth } from '../shared/auth/AuthContext';

export function LoginPage() {
  const nav = useNavigate();
  const { setToken } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await login({ email, password });
      setToken(res.token);
      if (res.user.role === 'doctor') nav('/doctor');
      else nav('/');
    } catch (err) {
      if (err instanceof HttpError) setError(err.message);
      else setError('Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 520, margin: '32px auto', padding: 16 }}>
      <h2>Login</h2>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </label>
        <label>
          Password
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        </label>
        <button disabled={busy} type="submit">
          {busy ? 'Signing in…' : 'Login'}
        </button>
        {error && <div style={{ color: 'crimson' }}>{error}</div>}
      </form>

      <p style={{ marginTop: 16 }}>
        No account? <Link to="/register">Register</Link>
      </p>
    </div>
  );
}
