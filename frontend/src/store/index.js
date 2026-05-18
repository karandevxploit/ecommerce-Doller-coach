import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api, apiCall, safeApi, setAccessToken, clearAuth } from "../api/client";
import { ENDPOINTS } from "../api/endpoints";
import { mapUser, mapCartItem, mapProduct } from "../api/dynamicMapper";
import toast from "react-hot-toast";

const getBody = (res) => res?.data ?? res;
const getPayload = (res) => {
  const body = getBody(res);
  return body?.data ?? body;
};

const getList = (res, key) => {
  const payload = getPayload(res);

  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.[key])) return payload[key];
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.products)) return payload.products;
  if (Array.isArray(payload?.data)) return payload.data;

  return [];
};

const getToken = () =>
  localStorage.getItem("accessToken") || localStorage.getItem("token");

const normalizeSession = (res) => {
  const payload = getPayload(res);

  const user =
    payload?.user ||
    payload?.data?.user ||
    payload?.profile ||
    null;

  const token =
    payload?.accessToken ||
    payload?.token ||
    payload?.data?.accessToken ||
    payload?.data?.token ||
    null;

  return { user, token };
};

const persistToken = (token) => {
  if (!token) return;
  setAccessToken(token);
  localStorage.setItem("token", token);
  localStorage.setItem("accessToken", token);
};

/* =========================================================
   AUTH STORE
========================================================= */
export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isAdminAuthenticated: false,
      loading: false,
      isInitialized: false,
      isFetchingUser: false,
      isAuthModalOpen: false,
      addresses: [],
      error: null,

      openAuthModal: () => set({ isAuthModalOpen: true }),
      closeAuthModal: () => set({ isAuthModalOpen: false }),

      /* ---------------- LOGIN ---------------- */
      login: async (payload = {}, provider = "login") => {
        set({ loading: true, error: null });

        try {
          const isAdmin =
            payload.role === "admin" || String(provider).includes("admin");

          const endpoint = isAdmin
            ? ENDPOINTS.AUTH.ADMIN_LOGIN
            : `/auth/${provider}`;

          const res = await safeApi.post(endpoint, payload);

          if (res?.success === false) {
            throw new Error(res?.message || "Invalid login response from server");
          }

          const { user, token } = normalizeSession(res);

          if (!user || !token || typeof token !== "string") {
            throw new Error("Invalid login response from server");
          }

          const mappedUser = mapUser(user);
          const isAdminUser = mappedUser?.role === "admin" || user?.role === "admin";

          persistToken(token);

          set({
            user: mappedUser,
            token,
            isAuthenticated: true,
            isAdminAuthenticated: isAdminUser,
            isInitialized: true,
            error: null,
          });

          return true;
        } catch (err) {
          const msg =
            err?.response?.data?.message ||
            err?.message ||
            "Login failed";

          set({ error: msg });
          toast.error(msg);
          return false;
        } finally {
          set({ loading: false });
        }
      },

      /* ---------------- SESSION ---------------- */
      setSession: (res) => {
        const { user, token } = normalizeSession(res);

        if (!user || !token || typeof token !== "string") {
          return false;
        }

        const mappedUser = mapUser(user);
        const isAdmin = mappedUser?.role === "admin" || user?.role === "admin";

        persistToken(token);

        set({
          user: mappedUser,
          token,
          isAuthenticated: true,
          isAdminAuthenticated: isAdmin,
          isInitialized: true,
          error: null,
        });

        return true;
      },

      /* ---------------- FETCH USER ---------------- */
      fetchUser: async () => {
        const token = getToken();

        if (!token) {
          clearAuth();
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isAdminAuthenticated: false,
            isInitialized: true,
            isFetchingUser: false,
          });
          return false;
        }

        persistToken(token);
        set({ loading: true, isFetchingUser: true, error: null });

        try {
          const res = await apiCall(() => api.get("/auth/me"));

          if (!res?.success) {
            throw new Error(res?.message || "No user data");
          }

          const payload = getPayload(res);
          const userData = payload?.user || payload;

          if (!userData) throw new Error("No user data");

          const mappedUser = mapUser(userData);

          set({
            user: mappedUser,
            token,
            isAuthenticated: true,
            isAdminAuthenticated: mappedUser?.role === "admin",
            isInitialized: true,
            error: null,
          });

          return true;
        } catch {
          clearAuth();
          localStorage.removeItem("token");
          localStorage.removeItem("accessToken");

          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isAdminAuthenticated: false,
            isInitialized: true,
          });

          return false;
        } finally {
          set({ loading: false, isFetchingUser: false });
        }
      },

      /* ---------------- LOGOUT ---------------- */
      logout: async () => {
        api.post(ENDPOINTS.AUTH.LOGOUT).catch(() => { });

        clearAuth();
        localStorage.removeItem("auth-storage");
        localStorage.removeItem("token");
        localStorage.removeItem("accessToken");

        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isAdminAuthenticated: false,
          isInitialized: true,
          isAuthModalOpen: false,
          addresses: [],
          error: null,
        });
      },

      /* ---------------- ADDRESSES ---------------- */
      fetchAddresses: async () => {
        try {
          const res = await safeApi.get(ENDPOINTS.AUTH.ADDRESSES);

          if (res?.success === false) {
            throw new Error(res?.message || "Failed to load addresses");
          }

          set({ addresses: getList(res, "addresses") });
        } catch (err) {
          toast.error(err?.message || "Failed to load addresses");
        }
      },

      addAddress: async (data) => {
        try {
          const res = await safeApi.post(ENDPOINTS.AUTH.ADDRESSES, data);

          if (res?.success === false) {
            throw new Error(res?.message || "Failed to add address");
          }

          const payload = getPayload(res);
          const newAddress = payload?.address || payload;

          set((state) => ({
            addresses: [newAddress, ...(state.addresses || [])].filter(Boolean),
          }));

          toast.success("Address added");
          return newAddress;
        } catch (err) {
          toast.error(
            err?.response?.data?.message ||
            err?.message ||
            "Failed to add address"
          );
          throw err;
        }
      },

      deleteAddress: async (id) => {
        if (!id) return false;

        try {
          const res = await safeApi.delete(`${ENDPOINTS.AUTH.ADDRESSES}/${id}`);

          if (res?.success === false) {
            throw new Error(res?.message || "Failed to remove address");
          }

          set((state) => ({
            addresses: (state.addresses || []).filter(
              (address) => String(address.id || address._id) !== String(id)
            ),
          }));

          toast.success("Address removed");
          return true;
        } catch (err) {
          toast.error(
            err?.response?.data?.message ||
            err?.message ||
            "Failed to remove address"
          );
          return false;
        }
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        isAdminAuthenticated: state.isAdminAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          persistToken(state.token);
          state.isAuthenticated = true;
          state.isAdminAuthenticated = state.user?.role === "admin";
        }
        if (state) state.isInitialized = true;
      },
    }
  )
);

/* =========================================================
   CART STORE
========================================================= */
export const useCartStore = create((set, get) => ({
  cart: [],
  isLoading: false,

  fetchCart: async () => {
    if (!getToken()) {
      set({ cart: [], isLoading: false });
      return [];
    }

    set({ isLoading: true });

    try {
      const res = await apiCall(() => api.get(ENDPOINTS.CART.BASE));

      if (!res?.success) {
        throw new Error(res?.message || "Failed to load cart");
      }

      const list = getList(res, "items");

      const mapped = list.map(mapCartItem).filter(Boolean);
      set({ cart: mapped });

      return mapped;
    } catch (err) {
      toast.error(err?.message || "Failed to load cart");
      return [];
    } finally {
      set({ isLoading: false });
    }
  },

  addToCart: async (...args) => {
    const productId = args[0];

    if (!productId) {
      toast.error("Invalid product");
      throw new Error("Invalid product");
    }

    try {
      const quantity = Math.max(1, Number(args[1]) || 1);

      const body = {
        productId: String(productId),
        quantity,
        size: args[2] || "",
        topSize: args[3] || "",
        bottomSize: args[4] || "",
        color: args[5] || "",
      };

      if (args[6] !== undefined) body.variantIdx = args[6];

      const res = await apiCall(() => api.post(ENDPOINTS.CART.ADD, body));

      if (!res?.success) {
        throw new Error(res?.message || "Failed to add item");
      }

      await get().fetchCart();
      return true;
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
        err?.message ||
        "Failed to add item"
      );
      throw err;
    }
  },

  updateQuantity: async (
    productId,
    size,
    quantity,
    color = null,
    topSize = null,
    bottomSize = null,
    variantIdx = null
  ) => {
    if (!productId) return false;

    const nextQty = Number(quantity) || 0;

    try {
      if (nextQty <= 0) {
        return get().removeFromCart(productId, size, color);
      }

      const res = await apiCall(() =>
        api.put(ENDPOINTS.CART.BASE, {
          productId,
          size: size || "",
          topSize: topSize || "",
          bottomSize: bottomSize || "",
          quantity: nextQty,
          color: color || "",
          ...(variantIdx !== null && variantIdx !== undefined ? { variantIdx } : {}),
        })
      );

      if (!res?.success) {
        throw new Error(res?.message || "Failed to update cart");
      }

      await get().fetchCart();
      return true;
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
        err?.message ||
        "Failed to update cart"
      );
      return false;
    }
  },

  removeFromCart: async (
    productId,
    size = null,
    color = null,
    topSize = null,
    bottomSize = null,
    variantIdx = null
  ) => {
    if (!productId) return false;

    try {
      const query = new URLSearchParams();
      if (size) query.append("size", size);
      if (color) query.append("color", color);
      if (topSize) query.append("topSize", topSize);
      if (bottomSize) query.append("bottomSize", bottomSize);
      if (variantIdx !== null && variantIdx !== undefined) query.append("variantIdx", variantIdx);

      const url = `${ENDPOINTS.CART.BASE}/${productId}${query.toString() ? `?${query.toString()}` : ""
        }`;

      const res = await apiCall(() => api.delete(url));

      if (!res?.success) {
        throw new Error(res?.message || "Failed to remove item");
      }

      await get().fetchCart();
      return true;
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
        err?.message ||
        "Failed to remove item"
      );
      return false;
    }
  },

  clearCart: () => set({ cart: [] }),

  get totalPrice() {
    return (get().cart || []).reduce(
      (acc, item) =>
        acc + (Number(item.price) || 0) * (Number(item.quantity) || 1),
      0
    );
  },
}));

/* =========================================================
   WISHLIST STORE
========================================================= */
export const useWishlistStore = create((set, get) => ({
  items: [],
  isLoading: false,

  fetchWishlist: async () => {
    if (!getToken()) {
      set({ items: [], isLoading: false });
      return [];
    }

    set({ isLoading: true });

    try {
      const res = await safeApi.get(ENDPOINTS.WISHLIST.BASE);

      if (res?.success === false) {
        throw new Error(res?.message || "Failed to load wishlist");
      }

      const mapped = getList(res, "items").map(mapProduct).filter(Boolean);
      set({ items: mapped });

      return mapped;
    } catch (err) {
      toast.error(err?.message || "Failed to load wishlist");
      return [];
    } finally {
      set({ isLoading: false });
    }
  },

  toggleWishlist: async (productId) => {
    if (!productId) {
      toast.error("Invalid product");
      return false;
    }

    const id = String(productId);
    const { items } = get();

    const exists = items.some(
      (product) => String(product.id || product._id) === id
    );

    try {
      if (exists) {
        const res = await safeApi.delete(`${ENDPOINTS.WISHLIST.BASE}/${id}`);

        if (res?.success === false) {
          throw new Error(res?.message || "Failed to update wishlist");
        }

        set({
          items: items.filter(
            (product) => String(product.id || product._id) !== id
          ),
        });

        return false;
      }

      const res = await safeApi.post(ENDPOINTS.WISHLIST.BASE, {
        productId: id,
      });

      if (res?.success === false) {
        throw new Error(res?.message || "Failed to update wishlist");
      }

      const payload = getPayload(res);
      const rawProduct = payload?.product || payload?.item || payload;
      const mappedProduct = mapProduct(rawProduct);

      if (mappedProduct) {
        set({ items: [mappedProduct, ...items] });
      } else {
        await get().fetchWishlist();
      }

      return true;
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
        err?.message ||
        "Failed to update wishlist"
      );
      return exists;
    }
  },

  isInWishlist: (id) => {
    if (!id) return false;
    return (get().items || []).some(
      (product) => String(product.id || product._id) === String(id)
    );
  },

  clearWishlist: () => set({ items: [] }),
}));
