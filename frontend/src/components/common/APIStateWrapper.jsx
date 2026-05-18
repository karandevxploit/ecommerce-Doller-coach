import React from "react";
import { AlertTriangle, RefreshCw, ServerCrash } from "lucide-react";
import Button from "../ui/Button";

const getErrorStatus = (error) => {
  return error?.response?.status || error?.status || null;
};

const getErrorMessage = (error, fallback) => {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  );
};

const isCancelledError = (error) => {
  return (
    error?.code === "ERR_CANCELED" ||
    error?.name === "CanceledError" ||
    error?.name === "AbortError"
  );
};

const getErrorCopy = (error) => {
  const status = getErrorStatus(error);

  if (status === 401) {
    return {
      title: "Session expired",
      message: "Please login again to continue.",
      icon: "alert",
    };
  }

  if (status === 403) {
    return {
      title: "Access denied",
      message: "You do not have permission to view this.",
      icon: "alert",
    };
  }

  if (status === 404) {
    return {
      title: "Not found",
      message: "The requested data could not be found.",
      icon: "alert",
    };
  }

  if (status === 429) {
    return {
      title: "Too many requests",
      message: "Please wait a moment and try again.",
      icon: "alert",
    };
  }

  if (status === 503) {
    return {
      title: "Server is busy",
      message: "We're having trouble loading this right now.",
      icon: "server",
    };
  }

  if (status >= 500) {
    return {
      title: "Server error",
      message: "The server could not complete this request.",
      icon: "server",
    };
  }

  if (error?.code === "BACKEND_UNREACHABLE") {
    return {
      title: "Backend unavailable",
      message: "Please make sure the API server is running.",
      icon: "server",
    };
  }

  return {
    title: "Something went wrong",
    message: "Please try again.",
    icon: "alert",
  };
};

export default function APIStateWrapper({
  isLoading = false,
  isError = false,
  error = null,
  isEmpty = false,
  loadingFallback = null,
  emptyFallback = null,
  onRetry,
  children,
}) {
  if (isLoading) {
    return (
      loadingFallback || (
        <div className="w-full h-48 bg-gray-50 animate-pulse rounded-xl flex items-center justify-center border">
          <span className="text-xs text-gray-400">Loading...</span>
        </div>
      )
    );
  }

  if (isError && !isCancelledError(error)) {
    const copy = getErrorCopy(error);
    const message = getErrorMessage(error, copy.message);

    return (
      <div className="w-full border border-red-100 bg-red-50 p-6 rounded-xl flex flex-col items-center text-center">
        {copy.icon === "server" ? (
          <ServerCrash className="w-8 h-8 text-red-500 mb-3" />
        ) : (
          <AlertTriangle className="w-8 h-8 text-red-500 mb-3" />
        )}

        <h3 className="text-sm font-semibold text-gray-900 mb-1">
          {copy.title}
        </h3>

        <p className="text-xs text-gray-500 mb-4 max-w-xs">{message}</p>

        {onRetry && (
          <Button
            type="button"
            onClick={onRetry}
            className="h-9 px-4 text-sm flex items-center gap-2"
          >
            <RefreshCw size={14} />
            Try again
          </Button>
        )}
      </div>
    );
  }

  if (isEmpty) {
    return (
      emptyFallback || (
        <div className="w-full border border-dashed bg-gray-50 p-10 rounded-xl flex items-center justify-center text-center">
          <p className="text-sm text-gray-400">No data available right now</p>
        </div>
      )
    );
  }

  return children || null;
}
