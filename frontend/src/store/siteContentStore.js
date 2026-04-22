import { create } from "zustand";
import { api } from "../api/client";
import { ENDPOINTS } from "../api/endpoints";
import toast from "react-hot-toast";

/* ---------------- DEFAULT ---------------- */
const DEFAULT_CONTENT = {
  branding: {
    logo: {
      url: "",
      public_id: "",
    },
  },
  heroCarousel: [],
  headings: {
    bestSellersTitle: "Best Sellers",
    trendingTitle: "Trending",
    newArrivalsTitle: "New Arrivals",
  },
  banners: {
    promoBanner: {
      image: "",
      text: "New Collection",
      subtext: "Explore latest styles",
    },
  },
};

/* ---------------- DEEP MERGE ---------------- */
const deepMerge = (target, source) => {
  if (!source) return target;

  // ✅ Arrays should be replaced entirely, not deep-merged
  if (Array.isArray(source)) return source;

  const output = { ...target };

  Object.keys(source).forEach((key) => {
    const srcVal = source[key];
    const tgtVal = target[key];

    if (
      srcVal instanceof Object &&
      !Array.isArray(srcVal) &&
      tgtVal instanceof Object &&
      !Array.isArray(tgtVal)
    ) {
      output[key] = deepMerge(tgtVal, srcVal);
    } else {
      // Direct assignment for primitives and arrays
      output[key] = srcVal;
    }
  });

  return output;
};

export const useSiteContentStore = create((set, get) => ({
  content: DEFAULT_CONTENT,
  previewContent: DEFAULT_CONTENT,
  isPreviewMode: false,
  isLoading: false,
  error: null,
  lastFetched: null,

  /* ---------------- FETCH ---------------- */
  fetchContent: async (force = false) => {
    const { isLoading, lastFetched } = get();
    const isFresh = lastFetched && Date.now() - lastFetched < 5 * 60 * 1000;

    if (!force && (isLoading || isFresh)) return;

    set({ isLoading: true, error: null });

    try {
      // ✅ Use the PUBLIC endpoint to avoid 401 redirect loops!
      const res = await api.get("/site-content");
      
      // ✅ Properly unwrap envelope: res.data -> { success: true, data: { ... } }
      const data = res?.data?.data || res?.data || DEFAULT_CONTENT;
      const merged = deepMerge(DEFAULT_CONTENT, data);

      set({
        content: merged,
        previewContent: merged,
        isPreviewMode: false,
        lastFetched: Date.now(),
      });
    } catch (err) {
      console.error("Failed to load site content:", err);
      set({ error: err?.response?.data?.message || "Failed to load content" });
      toast.error("Failed to load site content");
    } finally {
      set({ isLoading: false });
    }
  },

  /* ---------------- UPDATE ---------------- */
  updateContent: async (payload) => {
    set({ isLoading: true, error: null });

    try {
      // ✅ Use matched endpoint
      const res = await api.put("/admin/site-content", payload);

      // ✅ Properly unwrap saving response
      const updated = res?.data?.data || res?.data || null;

      if (!updated) {
        throw new Error("Invalid update response");
      }

      const merged = deepMerge(DEFAULT_CONTENT, updated);

      set({
        content: merged,
        previewContent: merged,
        isPreviewMode: false,
        lastFetched: Date.now(),
      });

      toast.success("Content updated successfully");
      return true;
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Failed to update content";
      set({ error: msg });
      toast.error(msg);
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  /* ---------------- PREVIEW ---------------- */
  updatePreview: (updates) => {
    set((state) => ({
      previewContent: deepMerge(
        state.previewContent,
        updates
      ),
      isPreviewMode: true,
    }));
  },

  setPreviewMode: (enabled) =>
    set({ isPreviewMode: enabled }),

  resetPreview: () =>
    set((state) => ({
      previewContent: state.content,
      isPreviewMode: false,
    })),

  /* ---------------- RESET ---------------- */
  resetContent: () =>
    set({
      content: DEFAULT_CONTENT,
      previewContent: DEFAULT_CONTENT,
      isPreviewMode: false,
      error: null,
      lastFetched: null,
    }),
}));