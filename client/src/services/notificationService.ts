import { io, Socket } from 'socket.io-client';
import api from './api';

export interface NotificationItem {
  _id: string;
  user_id: number;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  read: boolean;
  created_at: string;
  read_at?: string;
}

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5001';

export const notificationService = {
  list: async (limit = 20, offset = 0) => {
    const response = await api.get('/notifications', { params: { limit, offset } });
    return response.data.notifications as NotificationItem[];
  },

  unreadCount: async () => {
    const response = await api.get('/notifications/unread-count');
    return response.data.unread_count as number;
  },

  markRead: async (id: string) => {
    await api.patch(`/notifications/${id}/read`);
  },

  markAllRead: async () => {
    await api.patch('/notifications/read-all');
  },

  connectSocket: (token: string) => {
    const socket: Socket = io(SOCKET_URL, {
      transports: ['websocket'],
      auth: {
        token: `Bearer ${token}`,
      },
    });
    return socket;
  },
};
