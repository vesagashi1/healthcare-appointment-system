import { requestJson } from "./http";

export type TestResponse = {
  message: string;
  user?: unknown;
};

export function testPublic(): Promise<TestResponse> {
  return requestJson<TestResponse>("/api/test/public");
}

export function testProtected(token: string): Promise<TestResponse> {
  return requestJson<TestResponse>("/api/test/protected", { token });
}

export function testDoctorOnly(token: string): Promise<TestResponse> {
  return requestJson<TestResponse>("/api/test/doctor-only", { token });
}

export function testPatientOnly(token: string): Promise<TestResponse> {
  return requestJson<TestResponse>("/api/test/patient-only", { token });
}
