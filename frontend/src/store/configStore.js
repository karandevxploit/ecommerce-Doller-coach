import { create } from "zustand";
import { api } from "../api/client";

export const useConfigStore = create((set) => ({
  config: null,
  loading: false,

  fetchConfig: async () => {
    set({ loading: true });
    try {
      const data = await api.get("/config");
      set({ config: data });
    } catch {
      console.error("Failed to fetch brand config", err);
    } finally {
      set({ loading: false });
    }
  },

  updateConfig: async (payload) => {
    try {
      const data = await api.put("/admin/config", payload);
      set({ config: data });
      return data;
    } catch {
      console.error("Failed to update config", err);
      throw err;
    }
  },

  uploadLogo: async (file) => {
    const formData = new FormData();
    formData.append("logo", file);
    try {
      const data = await api.post("/admin/logo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      set((state) => ({ config: { ...state.config, logo: data.logo } }));
      return data.logo;
    } catch {
      console.error("Failed to upload logo", err);
      throw err;
    }
  },
}));
