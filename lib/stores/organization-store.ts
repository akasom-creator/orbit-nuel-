import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface OrganizationState {
  organizationId: string | null;
  setOrganizationId: (id: string) => void;
  clearOrganizationId: () => void;
}

export const useOrganizationStore = create<OrganizationState>()(
  persist(
    (set) => ({
      organizationId: null,
      setOrganizationId: (id: string) => set({ organizationId: id }),
      clearOrganizationId: () => set({ organizationId: null }),
    }),
    {
      name: 'organization-storage',
      partialize: (state: any) => ({ organizationId: state.organizationId }),
    } as any
  )
);