import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { io, Socket } from 'socket.io-client';

interface Notification {
  id: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  priority: string;
  isRead: boolean;
  relatedEntityId?: number;
  relatedEntityType?: string;
  createdAt: string;
  readAt?: string;
}

interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  socket: Socket | null;
  isConnected: boolean;
  cache: Record<string, number>; // cache timestamps
  isLoading: boolean;
  error: string | null;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  connectSocket: (userId: number) => void;
  disconnectSocket: () => void;
  // Optimistic updates with rollback
  markAsReadOptimistic: (id: number) => Promise<void>;
  markAllAsReadOptimistic: () => Promise<void>;
  // Cache invalidation
  invalidateCache: (key?: string) => void;
  // Error recovery
  retryFailedOperation: (operation: () => Promise<void>, retries?: number) => Promise<void>;
  // Enhanced sync with other stores
  syncWithEntityUpdates: (entityType: string, entityId: string, action: string) => void;
}

const API_BASE = 'http://localhost:3001/notifications';

export const useNotificationStore = create<NotificationStore>()(
  persist(
    (set, get) => ({
      notifications: [],
      unreadCount: 0,
      socket: null,
      isConnected: false,
      cache: {},
      isLoading: false,
      error: null,

      fetchNotifications: async () => {
        const cacheKey = 'notifications';
        const now = Date.now();
        const cached = get().cache[cacheKey];

        // Check if cache is still valid (5 minutes)
        if (cached && now - cached < 300000) {
          return;
        }

        get().setLoading(true);
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(API_BASE, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const notifications = await response.json();
            const unreadCount = notifications.filter((n: Notification) => !n.isRead).length;
            set({ notifications, unreadCount, cache: { ...get().cache, [cacheKey]: now } });
          }
        } catch (error) {
          get().setError(error instanceof Error ? error.message : 'Failed to fetch notifications');
        } finally {
          get().setLoading(false);
        }
      },

      markAsRead: async (id: number) => {
        try {
          const token = localStorage.getItem('token');
          await fetch(`${API_BASE}/${id}/read`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          const { notifications } = get();
          const updatedNotifications = notifications.map(n =>
            n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
          );
          const unreadCount = updatedNotifications.filter(n => !n.isRead).length;
          set({ notifications: updatedNotifications, unreadCount });
        } catch (error) {
          get().setError(error instanceof Error ? error.message : 'Failed to mark notification as read');
        }
      },

      markAllAsRead: async () => {
        try {
          const token = localStorage.getItem('token');
          await fetch(`${API_BASE}/read-all`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          const { notifications } = get();
          const updatedNotifications = notifications.map(n => ({
            ...n,
            isRead: true,
            readAt: new Date().toISOString()
          }));
          set({ notifications: updatedNotifications, unreadCount: 0 });
        } catch (error) {
          get().setError(error instanceof Error ? error.message : 'Failed to mark all notifications as read');
        }
      },

      markAsReadOptimistic: async (id: number) => {
        const originalNotification = get().notifications.find(n => n.id === id);
        if (!originalNotification || originalNotification.isRead) return;

        // Optimistic update
        const { notifications } = get();
        const updatedNotifications = notifications.map(n =>
          n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
        );
        const unreadCount = updatedNotifications.filter(n => !n.isRead).length;
        set({ notifications: updatedNotifications, unreadCount });

        try {
          await get().markAsRead(id);
        } catch (error) {
          // Rollback
          set({ notifications, unreadCount: notifications.filter(n => !n.isRead).length });
          get().setError(error instanceof Error ? error.message : 'Failed to mark notification as read');
        }
      },

      markAllAsReadOptimistic: async () => {
        const originalNotifications = [...get().notifications];

        // Optimistic update
        const updatedNotifications = originalNotifications.map(n => ({
          ...n,
          isRead: true,
          readAt: new Date().toISOString()
        }));
        set({ notifications: updatedNotifications, unreadCount: 0 });

        try {
          await get().markAllAsRead();
        } catch (error) {
          // Rollback
          set({ notifications: originalNotifications, unreadCount: originalNotifications.filter(n => !n.isRead).length });
          get().setError(error instanceof Error ? error.message : 'Failed to mark all notifications as read');
        }
      },

      connectSocket: (userId: number) => {
        const socket = io('http://localhost:3001', {
          auth: {
            token: localStorage.getItem('token'),
          },
        });

        socket.on('connect', () => {
          set({ isConnected: true });
          socket.emit('joinNotifications', userId);
        });

        socket.on('disconnect', () => {
          set({ isConnected: false });
        });

        socket.on('notification', (notification: Notification) => {
          const { notifications } = get();
          const updatedNotifications = [notification, ...notifications];
          const unreadCount = updatedNotifications.filter(n => !n.isRead).length;
          set({ notifications: updatedNotifications, unreadCount });
        });

        // Enhanced sync with other entities
        socket.on('projectCreated', (data) => get().syncWithEntityUpdates('project', data.id, 'created'));
        socket.on('projectUpdated', (data) => get().syncWithEntityUpdates('project', data.id, 'updated'));
        socket.on('projectDeleted', (data) => get().syncWithEntityUpdates('project', data.id, 'deleted'));
        socket.on('taskCreated', (data) => get().syncWithEntityUpdates('task', data.id, 'created'));
        socket.on('taskUpdated', (data) => get().syncWithEntityUpdates('task', data.id, 'updated'));
        socket.on('taskDeleted', (data) => get().syncWithEntityUpdates('task', data.id, 'deleted'));
        socket.on('userCreated', (data) => get().syncWithEntityUpdates('user', data.id, 'created'));
        socket.on('userUpdated', (data) => get().syncWithEntityUpdates('user', data.id, 'updated'));
        socket.on('userDeleted', (data) => get().syncWithEntityUpdates('user', data.id, 'deleted'));
        socket.on('fileUploaded', (data) => get().syncWithEntityUpdates('file', data.id, 'uploaded'));
        socket.on('fileUpdated', (data) => get().syncWithEntityUpdates('file', data.id, 'updated'));
        socket.on('fileDeleted', (data) => get().syncWithEntityUpdates('file', data.id, 'deleted'));

        set({ socket });
      },

      disconnectSocket: () => {
        const { socket } = get();
        if (socket) {
          socket.disconnect();
          set({ socket: null, isConnected: false });
        }
      },

      invalidateCache: (key?: string) => {
        if (key) {
          set((state) => ({
            cache: { ...state.cache, [key]: 0 },
          }));
        } else {
          set({ cache: {} });
        }
      },

      retryFailedOperation: async (operation: () => Promise<void>, retries = 3) => {
        for (let i = 0; i < retries; i++) {
          try {
            await operation();
            return;
          } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
          }
        }
      },

      syncWithEntityUpdates: (entityType: string, entityId: string, action: string) => {
        // Invalidate relevant caches when entities change
        get().invalidateCache(`${entityType}s`);
        get().invalidateCache('notifications');

        // Create notification for the entity change
        const notification: Notification = {
          id: Date.now(), // Temporary ID, will be replaced by server
          userId: parseInt(localStorage.getItem('userId') || '0'),
          type: `${entityType}_${action}`,
          title: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} ${action}`,
          message: `${entityType} with ID ${entityId} has been ${action}`,
          priority: 'medium',
          isRead: false,
          relatedEntityId: parseInt(entityId),
          relatedEntityType: entityType,
          createdAt: new Date().toISOString(),
        };

        const { notifications } = get();
        const updatedNotifications = [notification, ...notifications];
        const unreadCount = updatedNotifications.filter(n => !n.isRead).length;
        set({ notifications: updatedNotifications, unreadCount });
      },
    }),
    {
      name: 'notification-storage',
      partialize: (state) => ({
        notifications: state.notifications,
        unreadCount: state.unreadCount,
        cache: state.cache,
      }),
    }
  )
);