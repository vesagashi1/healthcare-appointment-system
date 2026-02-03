import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../shared/api/authApi';
import { HttpError } from '../shared/api/http';

export function RegisterPage() {
  const nav = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('doctor');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setDone(null);
    setBusy(true);
    try {
      await register({ name, email, password, role });
      setDone('Registered. You can login now.');
      setTimeout(() => nav('/login'), 500);
    } catch (err) {
      if (err instanceof HttpError) setError(err.message);
      else setError('Registration failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 520, margin: '32px auto', padding: 16 }}>
      <h2>Register</h2>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </label>
        <label>
          Password
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        </label>
        <label>
          Role
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="doctor">doctor</option>
            <option value="patient">patient</option>
            <option value="nurse">nurse</option>
            <option value="caregiver">caregiver</option>
            <option value="admin">admin</option>
          </select>
        </label>

        <button disabled={busy} type="submit">
          {busy ? 'Creating…' : 'Create account'}
        </button>
        {error && <div style={{ color: 'crimson' }}>{error}</div>}
        {done && <div style={{ color: 'green' }}>{done}</div>}
      </form>

      <p style={{ marginTop: 16 }}>
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </div>
  );
}
