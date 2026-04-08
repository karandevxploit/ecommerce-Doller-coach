import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "../api/client";
import { mapUser, mapCartItem, mapProduct } from "../api/dynamicMapper";
import toast from "react-hot-toast";

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isAdminAuthenticated: false,
      loading: false,

      login: async (payload, provider = "login") => {
        set({ loading: true });
        try {
          const isContextAdmin = payload.role === "admin" || String(provider).includes("admin");
          const endpoint = isContextAdmin ? `/auth/admin-login` : `/auth/${provider}`;
          
          const res = await api.post(endpoint, payload); 

          const token = res.token || res.data?.token || res.accessToken || res.data?.accessToken;
          const userData = res.user || res.data?.user || (res.token ? res : res.data);

          if (token && userData) {
            const isAdmin = userData.role === "admin";
            if (isAdmin) {
              localStorage.setItem("adminToken", token);
              localStorage.setItem("adminUser", JSON.stringify(userData));
            } else {
              localStorage.setItem("token", token);
            }

            set({ 
              user: mapUser(userData), 
              token, 
              isAuthenticated: true, 
              isAdminAuthenticated: isAdmin 
            });
            return true;
          }
          return false;
        } catch {
          console.error("Auth Store Error:", err);
          throw err;
        } finally {
          set({ loading: false });
        }
      },

      setSession: (res) => {
        const token = res.token || res.data?.token || res.accessToken || res.data?.accessToken;
        const userData = res.user || res.data?.user || (res.token ? res : res.data);
        
        if (token && userData) {
          const isAdmin = userData.role === "admin";
          if (isAdmin) {
            localStorage.setItem("adminToken", token);
            localStorage.setItem("adminUser", JSON.stringify(userData));
          } else {
            localStorage.setItem("token", token);
          }
          
          set({ 
            user: mapUser(userData), 
            token, 
            isAuthenticated: true, 
            isAdminAuthenticated: isAdmin 
          });
          return true;
        }
        return false;
      },

      fetchUser: async () => {
        const adminToken = localStorage.getItem("adminToken");
        const userToken = localStorage.getItem("token");
        
        if (!adminToken && !userToken) return;

        set({ loading: true });
        try {
          const res = await api.get("/auth/profile");
          const userData = res.user || res.data || res;
          const isAdmin = userData.role === "admin";
          
          set({ 
            user: mapUser(userData), 
            isAuthenticated: true, 
            isAdminAuthenticated: isAdmin 
          });
        } catch {
          get().logout();
        } finally {
          set({ loading: false });
        }
      },

      logout: () => {
        localStorage.removeItem("auth-storage");
        localStorage.removeItem("token");
        localStorage.removeItem("adminToken");
        localStorage.removeItem("adminUser");
        set({ 
          user: null, 
          token: null, 
          isAuthenticated: false, 
          isAdminAuthenticated: false, 
          addresses: [] 
        });
      },

      fetchAddresses: async () => {
        try {
          const res = await api.get("/auth/addresses");
          const list = res.data || [];
          set({ addresses: Array.isArray(list) ? list : [] });
        } catch {
          console.error("Failed to fetch addresses", err);
        }
      },

      addAddress: async (addressData) => {
        try {
          const res = await api.post("/auth/addresses", addressData);
          const data = res.data || res;
          set((state) => ({ addresses: [data, ...(state.addresses || [])] }));
          return data;
        } catch {
          toast.error(err.response?.data?.message || "Failed to add address");
          throw err;
        }
      },

      deleteAddress: async (id) => {
        try {
          await api.delete(`/auth/addresses/${id}`);
          set((state) => ({ addresses: state.addresses.filter((a) => (a.id || a._id) !== id) }));
          toast.success("Address removed");
        } catch {
          toast.error("Failed to remove address");
        }
      },

      setDefaultAddress: async (id) => {
        try {
          await api.post(`/auth/addresses/${id}/set-default`);
          set((state) => ({
            addresses: state.addresses.map((a) => ({
              ...a,
              isDefault: (a.id || a._id) === id,
            })),
          }));
          toast.success("Default address updated");
        } catch {
          toast.error("Failed to set default address");
        }
      },
    }),
    { name: "auth-storage" }
  )
);

export const useCartStore = create((set, get) => ({
  items: [],
  isLoading: false,

  fetchCart: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get("/cart");
      const list = res.data?.items || res.data || [];
      set({ items: Array.isArray(list) ? list.map(mapCartItem) : [] });
    } finally {
      set({ isLoading: false });
    }
  },

  addToCart: async (productId, quantity = 1, size = null, topSize = null, bottomSize = null) => {
    try {
      await api.post("/cart", { productId, quantity, size, topSize, bottomSize });
      await get().fetchCart();
    } catch {
      toast.error(err?.response?.data?.message || "Failed to add item");
      throw err;
    }
  },

  updateQuantity: async (productId, quantity) => {
    try {
      await api.put("/cart", { productId, quantity });
      await get().fetchCart();
    } catch {
      toast.error(err?.response?.data?.message || "Failed to update cart");
      throw err;
    }
  },

  removeItem: async (productId) => {
    try {
      await api.delete(`/cart/${productId}`);
      await get().fetchCart();
    } catch {
      toast.error(err?.response?.data?.message || "Failed to remove item");
      throw err;
    }
  },

  getCartTotal: () => {
    return get().items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  }
}));

export const useWishlistStore = create((set, get) => ({
  items: [],
  isLoading: false,

  fetchWishlist: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get("/wishlist");
      const list = Array.isArray(res) ? res : res.data || [];
      set({ items: list.map(mapProduct) });
    } finally {
      set({ isLoading: false });
    }
  },

  toggleWishlist: async (productId) => {
    const { items } = get();
    const isAdded = items.some((p) => p.id === productId);

    try {
      if (isAdded) {
        await api.delete(`/wishlist/${productId}`);
        set({ items: items.filter((p) => p.id !== productId) });
        toast.success("Removed from curation.");
      } else {
        const res = await api.post("/wishlist", { productId });
        const newItem = res?.data || res;
        set({ items: [mapProduct(newItem), ...items] });
        toast.success("Added to curation.");
      }
    } catch {
      toast.error("Curation Sync Failure");
    }
  },

  isInWishlist: (productId) => {
    return get().items.some((p) => p.id === productId);
  }
}));
