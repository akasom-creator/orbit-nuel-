import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { io, Socket } from 'socket.io-client';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar?: string;
  department?: string;
  status: 'active' | 'inactive';
  lastActive: string;
}

interface UserState {
  users: User[];
  currentUser: User | null;
  isLoading: boolean;
  error: string | null;
  cache: Record<string, number>; // cache timestamps
  socket: Socket | null;
  isConnected: boolean;
  setUsers: (users: User[]) => void;
  addUser: (user: User) => void;
  updateUser: (id: string, updates: Partial<User>) => void;
  deleteUser: (id: string) => void;
  setCurrentUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  // Optimistic updates with rollback
  createUserOptimistic: (user: Omit<User, 'id' | 'lastActive'>) => Promise<void>;
  updateUserOptimistic: (id: string, updates: Partial<User>) => Promise<void>;
  deleteUserOptimistic: (id: string) => Promise<void>;
  // Cache invalidation
  invalidateCache: (key?: string) => void;
  // WebSocket sync
  connectSocket: () => void;
  disconnectSocket: () => void;
  // Error recovery
  retryFailedOperation: (operation: () => Promise<void>, retries?: number) => Promise<void>;
}

const API_BASE = 'http://localhost:3001/users';

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      users: [],
      currentUser: null,
      isLoading: false,
      error: null,
      cache: {},
      socket: null,
      isConnected: false,

      setUsers: (users: User[]) => set({ users }),
      addUser: (user: User) =>
        set((state) => ({ users: [...state.users, user] })),
      updateUser: (id: string, updates: Partial<User>) =>
        set((state) => ({
          users: state.users.map((user) =>
            user.id === id ? { ...user, ...updates } : user
          ),
        })),
      deleteUser: (id: string) =>
        set((state) => ({
          users: state.users.filter((user) => user.id !== id),
        })),
      setCurrentUser: (user: User | null) => set({ currentUser: user }),
      setLoading: (loading: boolean) => set({ isLoading: loading }),
      setError: (error: string | null) => set({ error }),

      createUserOptimistic: async (userData) => {
        const tempId = `temp-${Date.now()}`;
        const optimisticUser: User = {
          ...userData,
          id: tempId,
          lastActive: new Date().toISOString(),
        };

        // Optimistic update
        get().addUser(optimisticUser);
        get().setLoading(true);

        try {
          const token = localStorage.getItem('token');
          const response = await fetch(API_BASE, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(userData),
          });

          if (!response.ok) throw new Error('Failed to create user');

          const realUser = await response.json();

          // Replace optimistic with real
          set((state) => ({
            users: state.users.map(u => u.id === tempId ? realUser : u),
          }));
        } catch (error) {
          // Rollback
          get().deleteUser(tempId);
          get().setError(error instanceof Error ? error.message : 'Unknown error');
        } finally {
          get().setLoading(false);
        }
      },

      updateUserOptimistic: async (id: string, updates: Partial<User>) => {
        const originalUser = get().users.find(u => u.id === id);
        if (!originalUser) return;

        // Optimistic update
        get().updateUser(id, { ...updates, lastActive: new Date().toISOString() });
        get().setLoading(true);

        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${API_BASE}/${id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(updates),
          });

          if (!response.ok) throw new Error('Failed to update user');

          const updatedUser = await response.json();
          get().updateUser(id, updatedUser);
        } catch (error) {
          // Rollback
          get().updateUser(id, originalUser);
          get().setError(error instanceof Error ? error.message : 'Unknown error');
        } finally {
          get().setLoading(false);
        }
      },

      deleteUserOptimistic: async (id: string) => {
        const userToDelete = get().users.find(u => u.id === id);
        if (!userToDelete) return;

        // Optimistic update
        get().deleteUser(id);
        get().setLoading(true);

        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${API_BASE}/${id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (!response.ok) throw new Error('Failed to delete user');
        } catch (error) {
          // Rollback
          get().addUser(userToDelete);
          get().setError(error instanceof Error ? error.message : 'Unknown error');
        } finally {
          get().setLoading(false);
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

      connectSocket: () => {
        const socket = io('http://localhost:3001', {
          auth: { token: localStorage.getItem('token') },
        });

        socket.on('connect', () => set({ isConnected: true }));
        socket.on('disconnect', () => set({ isConnected: false }));

        socket.on('userCreated', (user: User) => {
          get().addUser(user);
        });

        socket.on('userUpdated', (user: User) => {
          get().updateUser(user.id, user);
        });

        socket.on('userDeleted', (id: string) => {
          get().deleteUser(id);
        });

        set({ socket });
      },

      disconnectSocket: () => {
        const { socket } = get();
        if (socket) {
          socket.disconnect();
          set({ socket: null, isConnected: false });
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
    }),
    {
      name: 'user-storage',
      partialize: (state) => ({
        users: state.users,
        currentUser: state.currentUser,
        cache: state.cache,
      }),
    }
  )
);