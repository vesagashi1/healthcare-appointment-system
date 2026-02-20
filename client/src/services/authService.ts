import api from './api';
import { getAccessToken, setAccessToken } from './api';

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  role: string;
}

export const authService = {
  login: async (credentials: LoginCredentials) => {
    const response = await api.post('/auth/login', credentials);
    const { token, user } = response.data;
    setAccessToken(token);
    localStorage.setItem('user', JSON.stringify(user));
    return { token, user };
  },

  register: async (data: RegisterData) => {
    const response = await api.post('/auth/register', data);
    return response.data;
  },

  refresh: async () => {
    const response = await api.post('/auth/refresh');
    const { token, user } = response.data;
    setAccessToken(token);
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    }
    return { token, user };
  },

  logout: () => {
    api.post('/auth/logout').catch(() => undefined);
    setAccessToken(null);
    localStorage.removeItem('user');
  },

  getCurrentUser: (): User | null => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  getToken: (): string | null => {
    return getAccessToken();
  },

  isAuthenticated: (): boolean => {
    return !!getAccessToken() || !!localStorage.getItem('user');
  },
};
