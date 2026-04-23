import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api, setAccessToken, clearAuth } from "../api/client";
import { ENDPOINTS } from "../api/endpoints";
import { mapUser, mapCartItem, mapProduct } from "../api/dynamicMapper";
import toast from "react-hot-toast";

/* =========================================================
   AUTH STORE
========================================================= */
export const useAuthStore = create(
  persist(
    (set, get) => ({
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
      login: async (payload, provider = "login") => {
        set({ loading: true, error: null });

        try {
          const isAdmin =
            payload.role === "admin" ||
            String(provider).includes("admin");

          const endpoint = isAdmin
            ? ENDPOINTS.AUTH.ADMIN_LOGIN
            : `/auth/${provider}`;

          const res = await api.post(endpoint, payload);

          // 🛡️ Robust Response Mapping
          // Our backend returns { success: true, data: { accessToken, user }, message: "" }
          // Axios wraps this in res.data
          const root = res?.data || res;
          const data = root?.data || root; // Extract the inner 'data' if present

          const userData = data?.user;
          const token = data?.accessToken || data?.token;

          if (!userData || !token) {
            console.error("[AUTH_STORE] Invalid login structure:", { root, data });
            throw new Error("Invalid login response from server");
          }

          const isAdminUser = userData.role === "admin";

          setAccessToken(token);

          set({
            user: mapUser(userData),
            token,
            isAuthenticated: true,
            isAdminAuthenticated: isAdminUser,
            isInitialized: true,
          });

          return true;
        } catch (err) {
          const msg =
            err?.response?.data?.message ||
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
        // Handle various response wrappers (Axios, Fetch, or direct data)
        const root = res?.data || res;
        const payload = root?.data || root;

        const userData = payload?.user || payload;
        const token = payload?.accessToken || payload?.token;

        console.log(">>> [AUTH_STORE] Setting Session:", { 
          hasUser: !!userData, 
          hasToken: !!token,
          email: userData?.email 
        });

        if (!userData || !token || typeof token !== "string") {
          console.error(">>> [AUTH_STORE] Failed to set session: Missing data", { payload });
          return false;
        }

        const isAdmin = userData.role === "admin";

        setAccessToken(token);

        set({
          user: mapUser(userData),
          token,
          isAuthenticated: true,
          isAdminAuthenticated: isAdmin,
          isInitialized: true,
        });

        return true;
      },

      /* ---------------- FETCH USER (PERSISTENCE) ---------------- */
      fetchUser: async () => {
        set({ loading: true });
        
        try {
          // We always try /me because withCredentials: true sends the token cookie automatically
          const res = await api.get("/auth/me");
          
          const root = res?.data || res;
          const userData = root?.user || root?.data?.user || root?.data;

          if (userData && userData.id) {
            set({
              user: mapUser(userData),
              isAuthenticated: true,
              isAdminAuthenticated: userData.role === "admin",
              isInitialized: true,
            });
          } else {
             set({ isAuthenticated: false, isInitialized: true });
          }
        } catch (err) {
          console.error("Auth restore failed", err);
          clearAuth(); // Clears local storage
          set({ user: null, isAuthenticated: false, isInitialized: true });
        } finally {
          set({ loading: false });
        }
      },

      /* ---------------- LOGOUT ---------------- */
      logout: () => {
        api.post(ENDPOINTS.AUTH.LOGOUT).catch(() => { });
        clearAuth();

        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isAdminAuthenticated: false,
          isInitialized: true,
        });

        // Use setTimeout to ensure state is flushed before clearing storage
        setTimeout(() => {
          localStorage.removeItem("auth-storage");
          localStorage.removeItem("token");
          localStorage.removeItem("accessToken");
        }, 100);
      },

      /* ---------------- ADDRESSES ---------------- */
      fetchAddresses: async () => {
        try {
          const res = await api.get(
            ENDPOINTS.AUTH.ADDRESSES
          );
          set({
            addresses: Array.isArray(res?.data)
              ? res.data
              : [],
          });
        } catch {
          toast.error("Failed to load addresses");
        }
      },

      addAddress: async (data) => {
        try {
          const res = await api.post(
            ENDPOINTS.AUTH.ADDRESSES,
            data
          );

          const newAddress =
            res?.data || res;

          set((s) => ({
            addresses: [
              newAddress,
              ...(s.addresses || []),
            ],
          }));

          toast.success("Address added");
          return newAddress;
        } catch (err) {
          toast.error(
            err?.response?.data?.message ||
            "Failed to add address"
          );
          throw err;
        }
      },

      deleteAddress: async (id) => {
        try {
          await api.delete(
            `${ENDPOINTS.AUTH.ADDRESSES}/${id}`
          );

          set((s) => ({
            addresses: s.addresses.filter(
              (a) =>
                (a.id || a._id) !== id
            ),
          }));

          toast.success("Address removed");
        } catch {
          toast.error("Failed to remove address");
        }
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        isAdminAuthenticated:
          state.isAdminAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          state.isAuthenticated = true;
        }
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
    const token =
      localStorage.getItem("accessToken") ||
      localStorage.getItem("token");

    if (!token) return;

    set({ isLoading: true });

    try {
      const res = await api.get(ENDPOINTS.CARTS);
      const list =
        res?.items ||
        res?.data ||
        (Array.isArray(res) ? res : []);

      set({
        cart: (list || []).map(mapCartItem),
      });
    } catch {
      toast.error("Failed to load cart");
    } finally {
      set({ isLoading: false });
    }
  },

  addToCart: async (...args) => {
    try {
      await api.post(ENDPOINTS.CARTS, {
        productId: args[0],
        quantity: args[1],
        size: args[2],
        topSize: args[3],
        bottomSize: args[4],
        color: args[5],
        variantIdx: args[6],
      });

      await get().fetchCart();
      toast.success("Added to cart");
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
        "Failed to add item"
      );
      throw err;
    }
  },

  updateQuantity: async (
    productId,
    size,
    quantity,
    color = null
  ) => {
    try {
      if (quantity <= 0)
        return get().removeFromCart(
          productId,
          size,
          color
        );

      await api.put(ENDPOINTS.CARTS, {
        productId,
        size,
        quantity,
        color,
      });

      await get().fetchCart();
    } catch {
      toast.error("Failed to update cart");
    }
  },

  removeFromCart: async (
    productId,
    size = null,
    color = null
  ) => {
    try {
      const q = new URLSearchParams();
      if (size) q.append("size", size);
      if (color) q.append("color", color);

      await api.delete(
        `${ENDPOINTS.CARTS}/${productId}${q.toString() ? `?${q}` : ""
        }`
      );

      await get().fetchCart();
      toast.success("Item removed");
    } catch {
      toast.error("Failed to remove item");
    }
  },

  clearCart: () => set({ cart: [] }),

  get totalPrice() {
    return get().cart.reduce(
      (acc, i) =>
        acc + (i.price || 0) * (i.quantity || 1),
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
    const token =
      localStorage.getItem("accessToken") ||
      localStorage.getItem("token");

    if (!token) return;

    set({ isLoading: true });

    try {
      const res = await api.get(
        ENDPOINTS.WISHLISTS
      );

      const list =
        res?.data ||
        (Array.isArray(res) ? res : []);

      set({
        items: (list || []).map(mapProduct),
      });
    } catch {
      toast.error("Failed to load wishlist");
    } finally {
      set({ isLoading: false });
    }
  },

  toggleWishlist: async (productId) => {
    const { items } = get();
    const exists = items.some(
      (p) => p.id === productId
    );

    try {
      if (exists) {
        await api.delete(
          `${ENDPOINTS.WISHLISTS}/${productId}`
        );

        set({
          items: items.filter(
            (p) => p.id !== productId
          ),
        });

        toast.success("Removed from wishlist");
      } else {
        const res = await api.post(
          ENDPOINTS.WISHLISTS,
          { productId }
        );

        const newItem =
          res?.data || res;

        set({
          items: [
            mapProduct(newItem),
            ...items,
          ],
        });

        toast.success("Added to wishlist");
      }
    } catch {
      toast.error("Failed to update wishlist");
    }
  },

  isInWishlist: (id) =>
    get().items.some((p) => p.id === id),
}));