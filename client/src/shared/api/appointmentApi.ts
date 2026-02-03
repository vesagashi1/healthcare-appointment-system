import { requestJson } from './http';

export function approveAppointment(token: string, appointmentId: number) {
  return requestJson<{ message: string; appointment: unknown }>(
    `/api/appointments/${appointmentId}/approve`,
    { method: 'PATCH', token },
  );
}
