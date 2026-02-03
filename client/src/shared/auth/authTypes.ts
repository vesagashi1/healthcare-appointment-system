export type Role =
  | 'admin'
  | 'doctor'
  | 'nurse'
  | 'patient'
  | 'caregiver'
  | string;

export type AuthUser = {
  id: number;
  role: Role;
};
