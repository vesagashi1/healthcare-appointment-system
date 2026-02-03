import { requestJson } from "./http";

export type RegisterRequest = {
  name: string;
  email: string;
  password: string;
  role: string;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  message: string;
  token: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
};

export function login(body: LoginRequest): Promise<LoginResponse> {
  return requestJson<LoginResponse>("/api/auth/login", {
    method: "POST",
    body,
  });
}

export function register(
  body: RegisterRequest,
): Promise<{ message: string } | unknown> {
  return requestJson("/api/auth/register", { method: "POST", body });
}
