import React from "react";
import { AlertTriangle, RefreshCw, ServerCrash } from "lucide-react";
import Button from "../ui/Button";

export default function APIStateWrapper({
  isLoading,
  isError,
  error,
  isEmpty,
  loadingFallback,
  emptyFallback,
  onRetry,
  children,
}) {
  // ================= LOADING =================
  if (isLoading) {
    return (
      loadingFallback || (
        <div className="w-full h-48 bg-gray-50 animate-pulse rounded-xl flex items-center justify-center border">
          <span className="text-xs text-gray-400">
            Loading...
          </span>
        </div>
      )
    );
  }

  // ================= ERROR =================
  if (isError) {
    const status = error?.response?.status;

    const isRateLimited = status === 429;
    const isServerBusy = status === 503;

    let title = "Something went wrong";
    let message = "Please try again.";

    if (isRateLimited) {
      title = "Too many requests";
      message = "Please wait a moment and try again.";
    }

    if (isServerBusy) {
      title = "Server is busy";
      message = "We’re having trouble loading this right now.";
    }

    return (
      <div className="w-full border border-red-100 bg-red-50 p-6 rounded-xl flex flex-col items-center text-center">

        {isServerBusy ? (
          <ServerCrash className="w-8 h-8 text-red-500 mb-3" />
        ) : (
          <AlertTriangle className="w-8 h-8 text-red-500 mb-3" />
        )}

        <h3 className="text-sm font-semibold text-gray-900 mb-1">
          {title}
        </h3>

        <p className="text-xs text-gray-500 mb-4 max-w-xs">
          {error?.response?.data?.message || error?.message || message}
        </p>

        {onRetry && (
          <Button
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

  // ================= EMPTY =================
  if (isEmpty) {
    return (
      emptyFallback || (
        <div className="w-full border border-dashed bg-gray-50 p-10 rounded-xl flex items-center justify-center text-center">
          <p className="text-sm text-gray-400">
            No data available right now
          </p>
        </div>
      )
    );
  }

  // ================= SUCCESS =================
  return children;
}