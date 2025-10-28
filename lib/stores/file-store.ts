import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { io, Socket } from 'socket.io-client';

interface File {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  uploadedBy: string;
  uploadedAt: string;
  projectId?: string;
  tags: string[];
}

interface FileState {
  files: File[];
  isLoading: boolean;
  error: string | null;
  cache: Record<string, number>; // cache timestamps
  socket: Socket | null;
  isConnected: boolean;
  setFiles: (files: File[]) => void;
  addFile: (file: File) => void;
  updateFile: (id: string, updates: Partial<File>) => void;
  deleteFile: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  // Optimistic updates with rollback
  uploadFileOptimistic: (fileData: Omit<File, 'id' | 'uploadedAt'>) => Promise<void>;
  updateFileOptimistic: (id: string, updates: Partial<File>) => Promise<void>;
  deleteFileOptimistic: (id: string) => Promise<void>;
  // Cache invalidation
  invalidateCache: (key?: string) => void;
  // WebSocket sync
  connectSocket: () => void;
  disconnectSocket: () => void;
  // Error recovery
  retryFailedOperation: (operation: () => Promise<void>, retries?: number) => Promise<void>;
}

const API_BASE = 'http://localhost:3001/files';

export const useFileStore = create<FileState>()(
  persist(
    (set, get) => ({
      files: [],
      isLoading: false,
      error: null,
      cache: {},
      socket: null,
      isConnected: false,

      setFiles: (files: File[]) => set({ files }),
      addFile: (file: File) =>
        set((state) => ({ files: [...state.files, file] })),
      updateFile: (id: string, updates: Partial<File>) =>
        set((state) => ({
          files: state.files.map((file) =>
            file.id === id ? { ...file, ...updates } : file
          ),
        })),
      deleteFile: (id: string) =>
        set((state) => ({
          files: state.files.filter((file) => file.id !== id),
        })),
      setLoading: (loading: boolean) => set({ isLoading: loading }),
      setError: (error: string | null) => set({ error }),

      uploadFileOptimistic: async (fileData) => {
        const tempId = `temp-${Date.now()}`;
        const optimisticFile: File = {
          ...fileData,
          id: tempId,
          uploadedAt: new Date().toISOString(),
        };

        // Optimistic update
        get().addFile(optimisticFile);
        get().setLoading(true);

        try {
          const token = localStorage.getItem('token');
          const response = await fetch(API_BASE, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(fileData),
          });

          if (!response.ok) throw new Error('Failed to upload file');

          const realFile = await response.json();

          // Replace optimistic with real
          set((state) => ({
            files: state.files.map(f => f.id === tempId ? realFile : f),
          }));
        } catch (error) {
          // Rollback
          get().deleteFile(tempId);
          get().setError(error instanceof Error ? error.message : 'Unknown error');
        } finally {
          get().setLoading(false);
        }
      },

      updateFileOptimistic: async (id: string, updates: Partial<File>) => {
        const originalFile = get().files.find(f => f.id === id);
        if (!originalFile) return;

        // Optimistic update
        get().updateFile(id, updates);
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

          if (!response.ok) throw new Error('Failed to update file');

          const updatedFile = await response.json();
          get().updateFile(id, updatedFile);
        } catch (error) {
          // Rollback
          get().updateFile(id, originalFile);
          get().setError(error instanceof Error ? error.message : 'Unknown error');
        } finally {
          get().setLoading(false);
        }
      },

      deleteFileOptimistic: async (id: string) => {
        const fileToDelete = get().files.find(f => f.id === id);
        if (!fileToDelete) return;

        // Optimistic update
        get().deleteFile(id);
        get().setLoading(true);

        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${API_BASE}/${id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (!response.ok) throw new Error('Failed to delete file');
        } catch (error) {
          // Rollback
          get().addFile(fileToDelete);
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

        socket.on('fileUploaded', (file: File) => {
          get().addFile(file);
        });

        socket.on('fileUpdated', (file: File) => {
          get().updateFile(file.id, file);
        });

        socket.on('fileDeleted', (id: string) => {
          get().deleteFile(id);
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
      name: 'file-storage',
      partialize: (state) => ({
        files: state.files,
        cache: state.cache,
      }),
    }
  )
);