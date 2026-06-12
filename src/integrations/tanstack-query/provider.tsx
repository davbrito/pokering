import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { environmentManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";

export function getQueryContext() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
        gcTime: Infinity,
      },
    },
  });

  if (!environmentManager.isServer()) {
    const asyncStoragePersister = createAsyncStoragePersister({
      storage: window.localStorage,
    });
    persistQueryClient({
      queryClient,
      persister: asyncStoragePersister,
    });
  }

  return {
    queryClient,
    Provider(props: { children: React.ReactNode }) {
      return <QueryClientProvider client={queryClient}>{props.children}</QueryClientProvider>;
    },
  };
}
