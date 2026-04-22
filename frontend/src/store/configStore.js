import { create } from "zustand";
import { api } from "../api/client";

export const useConfigStore = create((set, get) => ({
  config: null,
  loading: false,
  error: null,
  lastFetched: null,

  /* ---------------- FETCH CONFIG ---------------- */
  fetchConfig: async (force = false) => {
    const { loading, config, lastFetched } = get();

    // Prevent duplicate calls + simple cache (5 min)
    const isFresh =
      lastFetched &&
      Date.now() - lastFetched < 5 * 60 * 1000;

    if (!force && (loading || (config && isFresh))) return;

    set({ loading: true, error: null });

    try {
      const res = await api.get("/config");

      const data =
        res?.data ||
        res ||
        null;

      if (!data) {
        throw new Error("Invalid config response");
      }

      set({
        config: data,
        loading: false,
        lastFetched: Date.now(),
      });
    } catch (err) {
      console.error("Config fetch failed:", err);

      set({
        error:
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load configuration",
        loading: false,
      });
    }
  },

  /* ---------------- UPDATE CONFIG ---------------- */
  updateConfig: async (payload) => {
    set({ loading: true, error: null });

    try {
      const res = await api.put("/admin/config", payload);

      const data =
        res?.data ||
        res ||
        null;

      if (!data) {
        throw new Error("Invalid update response");
      }

      set({
        config: data,
        loading: false,
        lastFetched: Date.now(),
      });

      return data;
    } catch (err) {
      console.error("Config update failed:", err);

      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to update configuration";

      set({
        error: message,
        loading: false,
      });

      throw new Error(message);
    }
  },

  /* ---------------- RESET ---------------- */
  resetConfig: () => {
    set({
      config: null,
      error: null,
      loading: false,
      lastFetched: null,
    });
  },
}));