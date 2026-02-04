import { requestJson } from "./http";

export type AppointmentStatus =
  | "scheduled"
  | "approved"
  | "completed"
  | "cancelled"
  | "no_show";

export type AppointmentListItem = {
  id: number;
  appointment_date: string;
  status: AppointmentStatus;
  created_at: string;
  doctor_id: number;
  specialization: string;
  doctor_name: string;
  doctor_email: string;
  patient_id: number;
  patient_name: string;
  patient_email: string;
};

export type ListAppointmentsResponse = {
  message: string;
  appointments: AppointmentListItem[];
  count: number;
};

export function listAppointments(
  token: string,
  filters?: {
    patient_id?: string;
    doctor_id?: string;
    status?: AppointmentStatus | "";
    start_date?: string;
    end_date?: string;
  },
) {
  const params = new URLSearchParams();
  if (filters?.patient_id) params.set("patient_id", filters.patient_id);
  if (filters?.doctor_id) params.set("doctor_id", filters.doctor_id);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.start_date) params.set("start_date", filters.start_date);
  if (filters?.end_date) params.set("end_date", filters.end_date);

  const query = params.toString();
  const url = `/api/appointments${query ? `?${query}` : ""}`;
  return requestJson<ListAppointmentsResponse>(url, { method: "GET", token });
}

export function approveAppointment(token: string, appointmentId: number) {
  return requestJson<{ message: string; appointment: unknown }>(
    `/api/appointments/${appointmentId}/approve`,
    { method: "PATCH", token },
  );
}

export function cancelAppointment(token: string, appointmentId: number) {
  return requestJson<{ message: string; appointment: unknown }>(
    `/api/appointments/${appointmentId}/cancel`,
    { method: "PATCH", token },
  );
}
