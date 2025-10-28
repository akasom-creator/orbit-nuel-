import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { io, Socket } from 'socket.io-client';

interface Project {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'on-hold';
  progress: number;
  dueDate: string;
  team: string[];
  createdAt: string;
  updatedAt: string;
}

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;
  cache: Record<string, number>; // cache timestamps
  socket: Socket | null;
  isConnected: boolean;
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  setCurrentProject: (project: Project | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  // Optimistic updates with rollback
  createProjectOptimistic: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateProjectOptimistic: (id: string, updates: Partial<Project>) => Promise<void>;
  deleteProjectOptimistic: (id: string) => Promise<void>;
  // Cache invalidation
  invalidateCache: (key?: string) => void;
  // WebSocket sync
  connectSocket: () => void;
  disconnectSocket: () => void;
  // Error recovery
  retryFailedOperation: (operation: () => Promise<void>, retries?: number) => Promise<void>;
}

const API_BASE = 'http://localhost:3001/projects';

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      currentProject: null,
      isLoading: false,
      error: null,
      cache: {},
      socket: null,
      isConnected: false,

      setProjects: (projects: Project[]) => set({ projects }),
      addProject: (project: Project) =>
        set((state) => ({ projects: [...state.projects, project] })),
      updateProject: (id: string, updates: Partial<Project>) =>
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === id ? { ...project, ...updates } : project
          ),
        })),
      deleteProject: (id: string) =>
        set((state) => ({
          projects: state.projects.filter((project) => project.id !== id),
        })),
      setCurrentProject: (project: Project | null) => set({ currentProject: project }),
      setLoading: (loading: boolean) => set({ isLoading: loading }),
      setError: (error: string | null) => set({ error }),

      createProjectOptimistic: async (projectData) => {
        const tempId = `temp-${Date.now()}`;
        const optimisticProject: Project = {
          ...projectData,
          id: tempId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Optimistic update
        get().addProject(optimisticProject);
        get().setLoading(true);

        try {
          const token = localStorage.getItem('token');
          const response = await fetch(API_BASE, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(projectData),
          });

          if (!response.ok) throw new Error('Failed to create project');

          const realProject = await response.json();

          // Replace optimistic with real
          set((state) => ({
            projects: state.projects.map(p => p.id === tempId ? realProject : p),
          }));
        } catch (error) {
          // Rollback
          get().deleteProject(tempId);
          get().setError(error instanceof Error ? error.message : 'Unknown error');
        } finally {
          get().setLoading(false);
        }
      },

      updateProjectOptimistic: async (id: string, updates: Partial<Project>) => {
        const originalProject = get().projects.find(p => p.id === id);
        if (!originalProject) return;

        // Optimistic update
        get().updateProject(id, { ...updates, updatedAt: new Date().toISOString() });
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

          if (!response.ok) throw new Error('Failed to update project');

          const updatedProject = await response.json();
          get().updateProject(id, updatedProject);
        } catch (error) {
          // Rollback
          get().updateProject(id, originalProject);
          get().setError(error instanceof Error ? error.message : 'Unknown error');
        } finally {
          get().setLoading(false);
        }
      },

      deleteProjectOptimistic: async (id: string) => {
        const projectToDelete = get().projects.find(p => p.id === id);
        if (!projectToDelete) return;

        // Optimistic update
        get().deleteProject(id);
        get().setLoading(true);

        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${API_BASE}/${id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (!response.ok) throw new Error('Failed to delete project');
        } catch (error) {
          // Rollback
          get().addProject(projectToDelete);
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

        socket.on('projectCreated', (project: Project) => {
          get().addProject(project);
        });

        socket.on('projectUpdated', (project: Project) => {
          get().updateProject(project.id, project);
        });

        socket.on('projectDeleted', (id: string) => {
          get().deleteProject(id);
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
      name: 'project-storage',
      partialize: (state) => ({
        projects: state.projects,
        currentProject: state.currentProject,
        cache: state.cache,
      }),
    }
  )
);