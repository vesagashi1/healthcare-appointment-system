import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { HttpError } from "../../shared/api/http";
import {
  createPatientRecord,
  getPatientRecords,
  type PatientRecord,
} from "../../shared/api/patientApi";
import { useAuth } from "../../shared/auth/AuthContext";

export function DoctorPatientRecordsPage() {
  const { token } = useAuth();

  const [patientIdText, setPatientIdText] = useState("");
  const patientId = useMemo(() => {
    const n = Number(patientIdText);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [patientIdText]);

  const [records, setRecords] = useState<PatientRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [recordType, setRecordType] = useState("patient_note");
  const [content, setContent] = useState("");

  const load = async () => {
    if (!token) return;
    if (!patientId) {
      setError("Enter a valid patient ID");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await getPatientRecords(token, patientId);
      setRecords(res.records);
    } catch (err) {
      if (err instanceof HttpError) setError(err.message);
      else setError("Failed to load records");
    } finally {
      setBusy(false);
    }
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!patientId) {
      setError("Enter a valid patient ID");
      return;
    }
    if (!recordType || !content.trim()) {
      setError("record_type and content are required");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await createPatientRecord(token, patientId, {
        record_type: recordType,
        content,
      });
      setContent("");
      await load();
    } catch (err) {
      if (err instanceof HttpError) setError(err.message);
      else setError("Failed to create record");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: "32px auto", padding: 16 }}>
      <h3>Patient Records</h3>

      <div
        style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}
      >
        <label>
          Patient ID
          <input
            value={patientIdText}
            onChange={(e) => setPatientIdText(e.target.value)}
            placeholder="e.g. 12"
          />
        </label>
        <button disabled={busy} onClick={load}>
          {busy ? "Loading…" : "Load records"}
        </button>
      </div>

      <hr style={{ margin: "16px 0" }} />

      <h4>Create record</h4>
      <form onSubmit={create} style={{ display: "grid", gap: 8 }}>
        <label>
          Record type
          <select
            value={recordType}
            onChange={(e) => setRecordType(e.target.value)}
          >
            <option value="patient_note">patient_note</option>
            <option value="nursing_note">nursing_note</option>
            <option value="doctor_note">doctor_note</option>
          </select>
        </label>
        <label>
          Content
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
          />
        </label>
        <button disabled={busy} type="submit">
          {busy ? "Saving…" : "Create record"}
        </button>
      </form>

      {error && <div style={{ color: "crimson", marginTop: 12 }}>{error}</div>}

      <hr style={{ margin: "16px 0" }} />

      <h4>Records</h4>
      {records.length === 0 ? (
        <p>No records loaded.</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {records.map((r) => (
            <div
              key={r.id}
              style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}
            >
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <b>#{r.id}</b>
                <span>type: {r.record_type}</span>
                <span>created_by: {r.created_by}</span>
                <span>
                  created_at: {new Date(r.created_at).toLocaleString()}
                </span>
              </div>
              <pre style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>
                {r.content}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
