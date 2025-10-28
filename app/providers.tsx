"use client"

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, useEffect } from 'react';
import { OrganizationProvider } from '@/lib/contexts/organization-context';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useProjectStore } from '@/lib/stores/project-store';
import { useTaskStore } from '@/lib/stores/task-store';
import { useUserStore } from '@/lib/stores/user-store';
import { useFileStore } from '@/lib/stores/file-store';
import { useNotificationStore } from '@/lib/stores/notification-store';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { OfflineBanner } from '@/components/ui/offline-banner';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        retry: (failureCount, error: any) => {
          // Don't retry on 4xx errors (client errors)
          if (error?.status >= 400 && error?.status < 500) {
            return false;
          }
          // Retry up to 3 times for other errors
          return failureCount < 3;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      },
      mutations: {
        retry: (failureCount, error: any) => {
          // Don't retry mutations on client errors
          if (error?.status >= 400 && error?.status < 500) {
            return false;
          }
          // Retry once for server errors
          return failureCount < 1;
        },
      },
    },
  }));

  // Initialize WebSocket connections when user is authenticated
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated && user) {
      // Connect all stores to WebSockets
      const userId = parseInt(user.id);
      useProjectStore.getState().connectSocket();
      useTaskStore.getState().connectSocket();
      useUserStore.getState().connectSocket();
      useFileStore.getState().connectSocket();
      useNotificationStore.getState().connectSocket(userId);

      // Cleanup function to disconnect sockets
      return () => {
        useProjectStore.getState().disconnectSocket();
        useTaskStore.getState().disconnectSocket();
        useUserStore.getState().disconnectSocket();
        useFileStore.getState().disconnectSocket();
        useNotificationStore.getState().disconnectSocket();
      };
    }
  }, [isAuthenticated, user]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <OrganizationProvider>
          <OfflineBanner />
          {children}
        </OrganizationProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}