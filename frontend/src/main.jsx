import { createRoot } from "react-dom/client";
import React from "react";
import "./index.css";
import App from "./App.jsx";
import { ErrorBoundary } from "./components/common/ErrorBoundary.jsx";
import { HelmetProvider } from "react-helmet-async";
import {
  QueryClientProvider,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "./api/queryClient";
import { Toaster } from "react-hot-toast";

/* ---------------- ROOT SAFETY ---------------- */
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>

        {/* GLOBAL TOAST */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              fontSize: "14px",
            },
          }}
        />
      </HelmetProvider>

      {/* DEVTOOLS (AUTO DISABLED IN PROD) */}
      {import.meta.env.DEV && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  </React.StrictMode>
);