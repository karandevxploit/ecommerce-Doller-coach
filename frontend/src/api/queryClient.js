import { QueryClient } from "@tanstack/react-query";

/**
 * PRODUCTION-GRADE QUERY CLIENT
 * - Balanced caching strategy
 * - Smart retry logic
 * - Better UX (no unnecessary refetch spam)
 * - Error-aware retries
 */

const shouldRetry = (failureCount, error) => {
  const status = error?.response?.status;

  // ❌ Do NOT retry on client errors (bad request, unauthorized, forbidden)
  if (status && [400, 401, 403, 404].includes(status)) return false;

  // ❌ Do NOT retry on rate limit
  if (status === 429) return false;

  // ✅ Retry network / server errors (max 2 times)
  return failureCount < 2;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // ✅ Better caching (less API spam)
      staleTime: 1000 * 60 * 2, // 2 minutes
      gcTime: 1000 * 60 * 15,   // 15 minutes

      // ❌ Avoid unnecessary refetch on tab switch
      refetchOnWindowFocus: false,

      // ✅ Retry intelligently
      retry: shouldRetry,

      retryDelay: (attemptIndex) =>
        Math.min(1000 * 2 ** attemptIndex, 8000),

      // ✅ Improve UX
      refetchOnReconnect: true,
      refetchOnMount: false,

      // ✅ Prevent unnecessary rerenders
      notifyOnChangeProps: "tracked",
    },

    mutations: {
      // ❌ Avoid retrying mutations (dangerous for POST/PUT)
      retry: 0,
    },
  },
});