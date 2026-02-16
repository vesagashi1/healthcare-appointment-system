import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import styles from "./AuthPage.module.css";

export function RegisterPage() {
  const nav = useNavigate();
  const { register } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setDone(null);
    setBusy(true);
    try {
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        setBusy(false);
        return;
      }
      await register(name, email, password, "patient");
      setDone("Registered. You can sign in now.");
      setTimeout(() => nav("/login"), 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || "Registration failed");
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
          <h1 className={styles.brandTitle}>Create your account</h1>
        </div>
        <p className={styles.brandSubtitle}>
          Patient accounts can be created here. Clinician and staff accounts are
          provisioned by your organization.
        </p>

        <div className={styles.illustration} aria-hidden="true">
          <svg
            viewBox="0 0 720 420"
            width="100%"
            height="100%"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <linearGradient id="rg" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stopColor="rgba(14,165,233,0.55)" />
                <stop offset="0.55" stopColor="rgba(99,102,241,0.45)" />
                <stop offset="1" stopColor="rgba(34,197,94,0.35)" />
              </linearGradient>
              <filter id="rblur" x="-20%" y="-20%" width="140%" height="140%">
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
              cx="240"
              cy="220"
              r="160"
              fill="url(#rg)"
              filter="url(#rblur)"
              opacity="0.85"
            />
            <circle
              cx="500"
              cy="160"
              r="130"
              fill="url(#rg)"
              filter="url(#rblur)"
              opacity="0.45"
            />

            <g
              transform="translate(90 105)"
              fill="rgba(255,255,255,0.14)"
              stroke="rgba(255,255,255,0.18)"
            >
              <rect x="0" y="0" width="300" height="210" rx="18" />
              <rect
                x="18"
                y="24"
                width="264"
                height="18"
                rx="9"
                fill="rgba(255,255,255,0.10)"
                stroke="rgba(255,255,255,0.12)"
              />
              <rect
                x="18"
                y="64"
                width="264"
                height="44"
                rx="14"
                fill="rgba(2,6,23,0.25)"
                stroke="rgba(255,255,255,0.10)"
              />
              <rect
                x="18"
                y="120"
                width="264"
                height="44"
                rx="14"
                fill="rgba(2,6,23,0.25)"
                stroke="rgba(255,255,255,0.10)"
              />
              <rect
                x="18"
                y="176"
                width="160"
                height="18"
                rx="9"
                fill="rgba(14,165,233,0.30)"
                stroke="rgba(186,230,253,0.20)"
              />
            </g>
          </svg>
        </div>

        <div className={styles.sideFooter}>
          <div className={styles.sideFooterRow}>
            <span className={styles.sideMuted}>Questions?</span>
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
            <h2 className={styles.cardTitle}>Register</h2>
            <p className={styles.cardHint}>It only takes a minute.</p>
          </header>

          <form onSubmit={onSubmit} className={styles.form}>
            <div className={styles.field}>
              <div className={styles.labelRow}>
                <span className={styles.label}>Name</span>
                <span className={styles.helper}>display name</span>
              </div>
              <input
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                placeholder="Dr. Jane Doe"
                required
              />
            </div>

            <div className={styles.field}>
              <div className={styles.labelRow}>
                <span className={styles.label}>Email</span>
                <span className={styles.helper}>used to sign in</span>
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
                <span className={styles.helper}>use a strong password</span>
              </div>
              <div className={styles.passwordRow}>
                <input
                  className={styles.input}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
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

            <div className={styles.field}>
              <div className={styles.labelRow}>
                <span className={styles.label}>Confirm password</span>
                <span className={styles.helper}>re-enter to confirm</span>
              </div>
              <input
                className={styles.input}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••"
                required
              />
            </div>

            <button className={styles.primaryBtn} disabled={busy} type="submit">
              {busy ? "Creating…" : "Create account"}
            </button>

            {error && <div className={styles.alert}>{error}</div>}
            {done && (
              <div className={`${styles.alert} ${styles.success}`}>{done}</div>
            )}

            <div className={styles.legal}>
              By creating an account you agree to our <a href="#">Terms</a> and{" "}
              <a href="#">Privacy Policy</a>.
            </div>
          </form>

          <footer className={styles.footer}>
            <span>
              Already have an account? <Link to="/login">Sign in</Link>
            </span>
            <Link to="/">Back home</Link>
          </footer>
        </section>
      </main>
    </div>
  );
}

export default RegisterPage;
