import { requestJson } from "./http";

export interface DoctorStats {
  totalPatients: number;
  pendingAppointments: number;
  totalAppointments: number;
  recentRecords: number;
  appointmentBreakdown: {
    pending: number;
    approved: number;
    completed: number;
    cancelled: number;
  };
}

export interface RecentActivity {
  id: number;
  appointment_date: string;
  status: string;
  created_at: string;
  patient_id: number;
  patient_name: string;
}

export interface TodayAppointment {
  id: number;
  appointment_date: string;
  status: string;
  patient_id: number;
  patient_name: string;
}

export interface DashboardData {
  message: string;
  stats: DoctorStats;
  recentActivity: RecentActivity[];
  todayAppointments: TodayAppointment[];
}

export interface Appointment {
  id: number;
  appointment_date: string;
  status: string;
  created_at: string;
  patient_id: number;
  patient_name: string;
  patient_email: string;
}

export interface Patient {
  id: number;
  user_id: number;
  name: string;
  email: string;
  ward_id: number;
  ward_name: string;
}

export interface DoctorMe {
  id: number;
  specialization: string;
  user_id: number;
  name: string;
  email: string;
  created_at: string;
}

export const doctorApi = {
  /**
   * Get current doctor profile (includes doctorId)
   */
  getMe: async (
    token: string,
  ): Promise<{ message: string; doctor: DoctorMe }> => {
    return requestJson<{ message: string; doctor: DoctorMe }>(
      "/api/doctors/me",
      {
        method: "GET",
        token,
      },
    );
  },

  /**
   * Get doctor dashboard statistics and recent activity
   */
  getDashboard: async (token: string): Promise<DashboardData> => {
    return requestJson<DashboardData>("/api/dashboard/doctor", {
      method: "GET",
      token,
    });
  },

  /**
   * Get doctor's appointments with optional filters
   */
  getMyAppointments: async (
    token: string,
    doctorId: number,
    filters?: {
      status?: string;
      start_date?: string;
      end_date?: string;
    },
  ): Promise<{
    message: string;
    appointments: Appointment[];
    count: number;
  }> => {
    const queryParams = new URLSearchParams();
    if (filters?.status) queryParams.append("status", filters.status);
    if (filters?.start_date)
      queryParams.append("start_date", filters.start_date);
    if (filters?.end_date) queryParams.append("end_date", filters.end_date);

    const queryString = queryParams.toString();
    const url = `/api/doctors/${doctorId}/appointments${queryString ? `?${queryString}` : ""}`;

    return requestJson(url, {
      method: "GET",
      token,
    });
  },

  /**
   * Get doctor's patients (from assigned wards)
   */
  getMyPatients: async (
    token: string,
    doctorId: number,
  ): Promise<{ message: string; patients: Patient[]; count: number }> => {
    return requestJson(`/api/doctors/${doctorId}/patients`, {
      method: "GET",
      token,
    });
  },

  /**
   * Approve an appointment
   */
  approveAppointment: async (
    token: string,
    appointmentId: number,
  ): Promise<{ message: string; appointment: Appointment }> => {
    return requestJson(`/api/appointments/${appointmentId}/approve`, {
      method: "PATCH",
      token,
    });
  },

  /**
   * Cancel an appointment
   */
  cancelAppointment: async (
    token: string,
    appointmentId: number,
  ): Promise<{ message: string; appointment: Appointment }> => {
    return requestJson(`/api/appointments/${appointmentId}/cancel`, {
      method: "PATCH",
      token,
    });
  },
};
