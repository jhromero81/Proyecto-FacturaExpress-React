/**
 * QueryClient.jsx
 * Configuración del cliente de React Query.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos
      gcTime: 1000 * 60 * 30,   // 30 minutos
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 2,
    },
  },
});

export default queryClient;
