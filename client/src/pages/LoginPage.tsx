import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../shared/api/authApi";
import { HttpError } from "../shared/api/http";
import { useAuth } from "../shared/auth/AuthContext";
import styles from "./AuthPage.module.css";

export function LoginPage() {
  const nav = useNavigate();
  const { setToken } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await login({ email, password });
      setToken(res.token);
      if (res.user.role === "doctor") nav("/doctor");
      else nav("/");
    } catch (err) {
      if (err instanceof HttpError) setError(err.message);
      else setError("Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.page}>
      <aside className={styles.brand}>
        <div className={styles.brandTop}>
          <div className={styles.logo} aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2Z"
                stroke="currentColor"
                opacity="0.9"
              />
              <path
                d="M12 7v10M7 12h10"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h1 className={styles.brandTitle}>Healthcare Appointment System</h1>
        </div>
        <p className={styles.brandSubtitle}>
          Secure sign-in for patients and clinicians.
        </p>

        <div className={styles.illustration} aria-hidden="true">
          <svg
            viewBox="0 0 720 420"
            width="100%"
            height="100%"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stopColor="rgba(99,102,241,0.55)" />
                <stop offset="0.55" stopColor="rgba(34,197,94,0.35)" />
                <stop offset="1" stopColor="rgba(14,165,233,0.35)" />
              </linearGradient>
              <filter id="blur" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="18" />
              </filter>
            </defs>

            <rect
              x="0"
              y="0"
              width="720"
              height="420"
              rx="22"
              fill="rgba(255,255,255,0.04)"
              stroke="rgba(255,255,255,0.10)"
            />
            <circle
              cx="210"
              cy="160"
              r="120"
              fill="url(#g)"
              filter="url(#blur)"
              opacity="0.9"
            />
            <circle
              cx="460"
              cy="260"
              r="140"
              fill="url(#g)"
              filter="url(#blur)"
              opacity="0.55"
            />

            <g fill="none" stroke="rgba(255,255,255,0.22)">
              <path
                d="M70 310 C 170 220, 250 360, 340 290 S 520 260, 650 310"
                strokeWidth="2"
              />
              <path
                d="M80 120 C 200 70, 250 160, 360 120 S 520 90, 640 140"
                strokeWidth="1.5"
                opacity="0.75"
              />
            </g>

            <g
              transform="translate(470 110)"
              fill="rgba(255,255,255,0.14)"
              stroke="rgba(255,255,255,0.18)"
            >
              <rect x="0" y="0" width="200" height="220" rx="18" />
              <rect
                x="18"
                y="26"
                width="164"
                height="18"
                rx="9"
                fill="rgba(255,255,255,0.10)"
                stroke="rgba(255,255,255,0.12)"
              />
              <rect
                x="18"
                y="70"
                width="164"
                height="44"
                rx="14"
                fill="rgba(2,6,23,0.25)"
                stroke="rgba(255,255,255,0.10)"
              />
              <rect
                x="18"
                y="126"
                width="164"
                height="44"
                rx="14"
                fill="rgba(2,6,23,0.25)"
                stroke="rgba(255,255,255,0.10)"
              />
              <rect
                x="18"
                y="182"
                width="164"
                height="18"
                rx="9"
                fill="rgba(99,102,241,0.35)"
                stroke="rgba(165,180,252,0.22)"
              />
            </g>
          </svg>
        </div>

        <div className={styles.sideFooter}>
          <div className={styles.sideFooterRow}>
            <span className={styles.sideMuted}>Need help?</span>
            <a
              className={styles.sideLink}
              href="mailto:support@yourclinic.example"
            >
              support@yourclinic.example
            </a>
          </div>
          <div className={styles.sideFooterRow}>
            <a className={styles.sideLink} href="#">
              Privacy
            </a>
            <span className={styles.sideDot}>•</span>
            <a className={styles.sideLink} href="#">
              Terms
            </a>
          </div>
        </div>
      </aside>

      <main className={styles.content}>
        <section className={styles.card}>
          <header className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Welcome back</h2>
            <p className={styles.cardHint}>
              Use your account email and password to continue.
            </p>
          </header>

          <form onSubmit={onSubmit} className={styles.form}>
            <div className={styles.field}>
              <div className={styles.labelRow}>
                <span className={styles.label}>Email</span>
                <span className={styles.helper}>e.g. doctor@test.com</span>
              </div>
              <input
                className={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                placeholder="you@hospital.com"
                required
              />
            </div>

            <div className={styles.field}>
              <div className={styles.labelRow}>
                <span className={styles.label}>Password</span>
                <span className={styles.helper}>
                  minimum 8 chars recommended
                </span>
              </div>
              <div className={styles.passwordRow}>
                <input
                  className={styles.input}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                />
                <button
                  className={styles.ghostBtn}
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button className={styles.primaryBtn} disabled={busy} type="submit">
              {busy ? "Signing in…" : "Sign in"}
            </button>

            {error && <div className={styles.alert}>{error}</div>}
          </form>

          <footer className={styles.footer}>
            <span>
              No account? <Link to="/register">Create one</Link>
            </span>
            <Link to="/">Back home</Link>
          </footer>
        </section>
      </main>
    </div>
  );
}
