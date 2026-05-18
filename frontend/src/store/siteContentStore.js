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

const CACHE_TIME = 5 * 60 * 1000;
let contentRequest = null;

/* ---------------- HELPERS ---------------- */
const isPlainObject = (value) => {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
};

const unwrapContent = (response) => {
  const body = response?.data ?? response;
  const payload = body?.data ?? body?.content ?? body?.siteContent ?? body;

  return isPlainObject(payload) ? payload : DEFAULT_CONTENT;
};

/* ---------------- DEEP MERGE ---------------- */
const deepMerge = (target = {}, source = {}) => {
  if (Array.isArray(source)) return source;
  if (!isPlainObject(source)) return target;

  const output = { ...(target || {}) };

  Object.keys(source).forEach((key) => {
    const srcVal = source[key];
    const tgtVal = target?.[key];

    if (Array.isArray(srcVal)) {
      output[key] = srcVal;
      return;
    }

    if (isPlainObject(srcVal) && isPlainObject(tgtVal)) {
      output[key] = deepMerge(tgtVal, srcVal);
      return;
    }

    if (srcVal !== undefined) {
      output[key] = srcVal;
    }
  });

  return output;
};

const cleanHeroCarousel = (slides) => {
  if (!Array.isArray(slides)) return [];

  return slides.map((slide, index) => ({
    image: String(slide?.image || slide?.imageUrl || ""),
    heading: String(slide?.heading || slide?.title || ""),
    subheading: String(slide?.subheading || slide?.subtitle || ""),
    order: Number(slide?.order ?? index) || 0,
    offer: {
      text: String(slide?.offer?.text || ""),
      enabled: Boolean(slide?.offer?.enabled),
      startDate: slide?.offer?.startDate || null,
      endDate: slide?.offer?.endDate || null,
    },
  }));
};

const removeUndefinedDeep = (value) => {
  if (Array.isArray(value)) {
    return value.map(removeUndefinedDeep);
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.entries(value).reduce((acc, [key, val]) => {
    if (val === undefined) return acc;

    acc[key] = removeUndefinedDeep(val);
    return acc;
  }, {});
};

const cleanContentPayload = (payload = {}) => {
  const cleanPayload = removeUndefinedDeep({
    ...payload,
    heroCarousel: Array.isArray(payload.heroCarousel)
      ? cleanHeroCarousel(payload.heroCarousel)
      : payload.heroCarousel,
  });

  Object.keys(cleanPayload).forEach((key) => {
    if (cleanPayload[key] === undefined || cleanPayload[key] === null) {
      delete cleanPayload[key];
    }
  });

  return cleanPayload;
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
    const { isLoading, lastFetched, content } = get();

    const isFresh =
      lastFetched && Date.now() - lastFetched < CACHE_TIME;

    if (!force && content && isFresh) return content;

    if (!force && isLoading && contentRequest) {
      return contentRequest;
    }

    set({ isLoading: true, error: null });

    contentRequest = api
      .get(ENDPOINTS.CMS.SITE_CONTENT)
      .then((res) => {
        const data = unwrapContent(res);
        const merged = deepMerge(DEFAULT_CONTENT, data);

        set({
          content: merged,
          previewContent: merged,
          isPreviewMode: false,
          lastFetched: Date.now(),
          error: null,
        });

        return merged;
      })
      .catch((err) => {
        const message =
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load content";

        set({ error: message });
        toast.error("Failed to load site content");

        return get().content || DEFAULT_CONTENT;
      })
      .finally(() => {
        contentRequest = null;
        set({ isLoading: false });
      });

    return contentRequest;
  },

  /* ---------------- UPDATE ---------------- */
  updateContent: async (payload = {}) => {
    if (!payload || typeof payload !== "object") {
      toast.error("Invalid content payload");
      return false;
    }

    set({ isLoading: true, error: null });

    try {
      const cleanPayload = cleanContentPayload(payload);

      const res = await api.put(ENDPOINTS.CMS.SITE_CONTENT, cleanPayload);
      const updated = unwrapContent(res);

      if (!updated) {
        throw new Error("Invalid update response");
      }

      const merged = deepMerge(DEFAULT_CONTENT, updated);

      set({
        content: merged,
        previewContent: merged,
        isPreviewMode: false,
        lastFetched: Date.now(),
        error: null,
      });

      toast.success("Content updated successfully");
      return true;
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to update content";

      set({ error: message });
      toast.error(message);
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  /* ---------------- PREVIEW ---------------- */
  updatePreview: (updates = {}) => {
    set((state) => ({
      previewContent: deepMerge(state.previewContent, updates),
      isPreviewMode: true,
    }));
  },

  setPreviewMode: (enabled) => {
    set((state) => ({
      isPreviewMode: Boolean(enabled),
      previewContent: enabled ? state.previewContent : state.content,
    }));
  },

  resetPreview: () => {
    set((state) => ({
      previewContent: state.content,
      isPreviewMode: false,
    }));
  },

  /* ---------------- RESET ---------------- */
  resetContent: () => {
    contentRequest = null;

    set({
      content: DEFAULT_CONTENT,
      previewContent: DEFAULT_CONTENT,
      isPreviewMode: false,
      isLoading: false,
      error: null,
      lastFetched: null,
    });
  },
}));

export default useSiteContentStore;
