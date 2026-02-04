import { requestJson } from "./http";

export type PatientRecord = {
  id: number;
  patient_id: number;
  created_by: number;
  record_type: string;
  content: string;
  created_at: string;
};

export type CreateRecordRequest = {
  record_type: string;
  content: string;
};

export function getPatientRecords(token: string, patientId: number) {
  return requestJson<{
    message: string;
    patientId: string;
    records: PatientRecord[];
  }>(`/api/patients/${patientId}/records`, { method: "GET", token });
}

export function createPatientRecord(
  token: string,
  patientId: number,
  body: CreateRecordRequest,
) {
  return requestJson<{
    message: string;
    record: PatientRecord;
  }>(`/api/patients/${patientId}/records`, { method: "POST", token, body });
}
