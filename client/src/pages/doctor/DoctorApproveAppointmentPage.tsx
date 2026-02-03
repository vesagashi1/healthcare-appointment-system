import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { approveAppointment } from "../../shared/api/appointmentApi";
import { HttpError } from "../../shared/api/http";
import { useAuth } from "../../shared/auth/AuthContext";

export function DoctorApproveAppointmentPage() {
  const { token } = useAuth();

  const [appointmentIdText, setAppointmentIdText] = useState("");
  const appointmentId = useMemo(() => {
    const n = Number(appointmentIdText);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [appointmentIdText]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!token) return;
    if (!appointmentId) {
      setError("Enter a valid appointment ID");
      return;
    }

    setBusy(true);
    try {
      await approveAppointment(token, appointmentId);
      setResult("Appointment approved");
    } catch (err) {
      if (err instanceof HttpError) setError(err.message);
      else setError("Failed to approve appointment");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: "32px auto", padding: 16 }}>
      <h3>Approve Appointment</h3>
      <form
        onSubmit={onSubmit}
        style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}
      >
        <label>
          Appointment ID
          <input
            value={appointmentIdText}
            onChange={(e) => setAppointmentIdText(e.target.value)}
            placeholder="e.g. 34"
          />
        </label>
        <button disabled={busy} type="submit">
          {busy ? "Approving…" : "Approve"}
        </button>
      </form>
      {error && <div style={{ color: "crimson", marginTop: 12 }}>{error}</div>}
      {result && <div style={{ color: "green", marginTop: 12 }}>{result}</div>}

      <p style={{ marginTop: 16, opacity: 0.8 }}>
        Note: the backend currently doesn’t expose a “list my appointments”
        endpoint, so this page approves by ID.
      </p>
    </div>
  );
}
