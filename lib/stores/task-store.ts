import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { io, Socket } from 'socket.io-client';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high';
  assignee: string;
  projectId: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
}

interface TaskState {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  cache: Record<string, number>; // cache timestamps
  socket: Socket | null;
  isConnected: boolean;
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  // Optimistic updates with rollback
  createTaskOptimistic: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateTaskOptimistic: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTaskOptimistic: (id: string) => Promise<void>;
  // Cache invalidation
  invalidateCache: (key?: string) => void;
  // WebSocket sync
  connectSocket: () => void;
  disconnectSocket: () => void;
  // Error recovery
  retryFailedOperation: (operation: () => Promise<void>, retries?: number) => Promise<void>;
}

const API_BASE = 'http://localhost:3001/tasks';

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: [],
      isLoading: false,
      error: null,
      cache: {},
      socket: null,
      isConnected: false,

      setTasks: (tasks: Task[]) => set({ tasks }),
      addTask: (task: Task) =>
        set((state) => ({ tasks: [...state.tasks, task] })),
      updateTask: (id: string, updates: Partial<Task>) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id ? { ...task, ...updates } : task
          ),
        })),
      deleteTask: (id: string) =>
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== id),
        })),
      setLoading: (loading: boolean) => set({ isLoading: loading }),
      setError: (error: string | null) => set({ error }),

      createTaskOptimistic: async (taskData) => {
        const tempId = `temp-${Date.now()}`;
        const optimisticTask: Task = {
          ...taskData,
          id: tempId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Optimistic update
        get().addTask(optimisticTask);
        get().setLoading(true);

        try {
          const token = localStorage.getItem('token');
          const response = await fetch(API_BASE, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(taskData),
          });

          if (!response.ok) throw new Error('Failed to create task');

          const realTask = await response.json();

          // Replace optimistic with real
          set((state) => ({
            tasks: state.tasks.map(t => t.id === tempId ? realTask : t),
          }));
        } catch (error) {
          // Rollback
          get().deleteTask(tempId);
          get().setError(error instanceof Error ? error.message : 'Unknown error');
        } finally {
          get().setLoading(false);
        }
      },

      updateTaskOptimistic: async (id: string, updates: Partial<Task>) => {
        const originalTask = get().tasks.find(t => t.id === id);
        if (!originalTask) return;

        // Optimistic update
        get().updateTask(id, { ...updates, updatedAt: new Date().toISOString() });
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

          if (!response.ok) throw new Error('Failed to update task');

          const updatedTask = await response.json();
          get().updateTask(id, updatedTask);
        } catch (error) {
          // Rollback
          get().updateTask(id, originalTask);
          get().setError(error instanceof Error ? error.message : 'Unknown error');
        } finally {
          get().setLoading(false);
        }
      },

      deleteTaskOptimistic: async (id: string) => {
        const taskToDelete = get().tasks.find(t => t.id === id);
        if (!taskToDelete) return;

        // Optimistic update
        get().deleteTask(id);
        get().setLoading(true);

        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${API_BASE}/${id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (!response.ok) throw new Error('Failed to delete task');
        } catch (error) {
          // Rollback
          get().addTask(taskToDelete);
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

        socket.on('taskCreated', (task: Task) => {
          get().addTask(task);
        });

        socket.on('taskUpdated', (task: Task) => {
          get().updateTask(task.id, task);
        });

        socket.on('taskDeleted', (id: string) => {
          get().deleteTask(id);
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
      name: 'task-storage',
      partialize: (state) => ({
        tasks: state.tasks,
        cache: state.cache,
      }),
    }
  )
);