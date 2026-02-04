import { Link } from "react-router-dom";
import { useAuth } from "../shared/auth/AuthContext";
import styles from "./HomePage.module.css";

export function HomePage() {
  const { user, logout } = useAuth();

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.hero}>
          <div className={styles.heroContent}>
            <div className={styles.heroTag}>
              Secure • Compliant • Easy to use
            </div>
            <h1 className={styles.heroTitle}>Healthcare Appointment System</h1>
            <p className={styles.heroSubtitle}>
              Book and manage medical appointments, access your health records,
              and communicate with your care team—all in one secure platform.
            </p>

            {!user ? (
              <div className={styles.heroCta}>
                <Link
                  className={`${styles.btn} ${styles.btnLarge} ${styles.btnPrimary}`}
                  to="/login"
                >
                  Sign in
                </Link>
                <Link
                  className={`${styles.btn} ${styles.btnLarge}`}
                  to="/register"
                >
                  Create patient account
                </Link>
              </div>
            ) : (
              <div className={styles.userBanner}>
                <div className={styles.userInfo}>
                  <div className={styles.userAvatar} aria-hidden="true">
                    {user.role.charAt(0).toUpperCase()}
                  </div>
                  <div className={styles.userText}>
                    <div className={styles.userName}>Welcome back</div>
                    <div className={styles.userRole}>{user.role}</div>
                  </div>
                </div>
                <div className={styles.userActions}>
                  {user.role === "doctor" && (
                    <Link
                      className={`${styles.btn} ${styles.btnPrimary}`}
                      to="/doctor"
                    >
                      Go to Dashboard
                    </Link>
                  )}
                  <button className={styles.btn} onClick={logout} type="button">
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className={styles.heroVisual} aria-hidden="true">
            <svg
              viewBox="0 0 600 600"
              width="100%"
              height="100%"
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                <linearGradient id="hg1" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0" stopColor="rgba(99,102,241,0.75)" />
                  <stop offset="0.45" stopColor="rgba(34,197,94,0.45)" />
                  <stop offset="1" stopColor="rgba(14,165,233,0.45)" />
                </linearGradient>
                <linearGradient id="hg2" x1="0" x2="1" y1="1" y2="0">
                  <stop offset="0" stopColor="rgba(14,165,233,0.65)" />
                  <stop offset="1" stopColor="rgba(99,102,241,0.35)" />
                </linearGradient>
                <filter id="hblur" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="28" />
                </filter>
              </defs>

              <circle
                cx="300"
                cy="300"
                r="220"
                fill="url(#hg1)"
                filter="url(#hblur)"
                opacity="0.95"
              />
              <circle
                cx="420"
                cy="200"
                r="160"
                fill="url(#hg2)"
                filter="url(#hblur)"
                opacity="0.65"
              />

              <g
                transform="translate(200 170)"
                fill="rgba(255,255,255,0.16)"
                stroke="rgba(255,255,255,0.20)"
                strokeWidth="2"
              >
                <rect x="0" y="0" width="200" height="260" rx="20" />
                <rect
                  x="16"
                  y="20"
                  width="168"
                  height="28"
                  rx="14"
                  fill="rgba(255,255,255,0.12)"
                  stroke="rgba(255,255,255,0.14)"
                />
                <rect
                  x="16"
                  y="68"
                  width="168"
                  height="56"
                  rx="16"
                  fill="rgba(2,6,23,0.30)"
                  stroke="rgba(255,255,255,0.12)"
                />
                <rect
                  x="16"
                  y="140"
                  width="168"
                  height="56"
                  rx="16"
                  fill="rgba(2,6,23,0.30)"
                  stroke="rgba(255,255,255,0.12)"
                />
                <rect
                  x="16"
                  y="212"
                  width="100"
                  height="28"
                  rx="14"
                  fill="rgba(99,102,241,0.45)"
                  stroke="rgba(165,180,252,0.25)"
                />
              </g>

              <g
                fill="none"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <circle cx="140" cy="240" r="32" />
                <path d="M 125 240 L 135 250 L 155 230" />
              </g>

              <g
                fill="none"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <circle cx="460" cy="380" r="32" />
                <path d="M 460 365 L 460 395 M 445 380 L 475 380" />
              </g>
            </svg>
          </div>
        </header>

        <section className={styles.features}>
          <div className={styles.feature}>
            <div className={styles.featureIcon} aria-hidden="true">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            </div>
            <h3 className={styles.featureTitle}>Easy Scheduling</h3>
            <p className={styles.featureText}>
              Book appointments with your providers in seconds
            </p>
          </div>

          <div className={styles.feature}>
            <div className={styles.featureIcon} aria-hidden="true">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
              </svg>
            </div>
            <h3 className={styles.featureTitle}>Medical Records</h3>
            <p className={styles.featureText}>
              Access your health information anytime, anywhere
            </p>
          </div>

          <div className={styles.feature}>
            <div className={styles.featureIcon} aria-hidden="true">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h3 className={styles.featureTitle}>Secure & Private</h3>
            <p className={styles.featureText}>
              Bank-level encryption protects your data
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
