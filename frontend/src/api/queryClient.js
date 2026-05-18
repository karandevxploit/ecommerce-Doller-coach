import { QueryClient } from "@tanstack/react-query";

const isCancelledRequest = (error) => {
  return (
    error?.code === "ERR_CANCELED" ||
    error?.name === "CanceledError" ||
    error?.name === "AbortError"
  );
};

const shouldRetry = (failureCount, error) => {
  if (isCancelledRequest(error)) return false;

  const status = error?.response?.status;

  if (status && [400, 401, 403, 404, 409, 422, 429].includes(status)) {
    return false;
  }

  return failureCount < 2;
};

const retryDelay = (attemptIndex) => {
  return Math.min(1000 * 2 ** attemptIndex, 8000);
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 15,
      cacheTime: 1000 * 60 * 15,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: false,
      retry: shouldRetry,
      retryDelay,
      notifyOnChangeProps: "tracked",
    },

    mutations: {
      retry: false,
    },
  },
});
