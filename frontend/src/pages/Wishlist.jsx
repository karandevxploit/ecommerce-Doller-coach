import { Heart, ArrowRight, Trash2 } from "lucide-react";
import Button from "../components/ui/Button";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useAuthStore, useWishlistStore } from "../store";
import ProductCard from "../components/ProductCard";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

export default function Wishlist() {
  const navigate = useNavigate();

  const { isAuthenticated, openAuthModal } = useAuthStore();

  const {
    items = [],
    isLoading,
    toggleWishlist,
    fetchWishlist,
  } = useWishlistStore();

  const [removingId, setRemovingId] = useState(null);

  const safeItems = useMemo(() => {
    return Array.isArray(items)
      ? items.filter((item) => item && typeof item === "object")
      : [];
  }, [items]);

  useEffect(() => {
    if (isAuthenticated && typeof fetchWishlist === "function") {
      fetchWishlist();
    }
  }, [isAuthenticated, fetchWishlist]);

  const handleLogin = () => {
    if (typeof openAuthModal === "function") {
      openAuthModal();
      return;
    }

    navigate("/login");
  };

  const handleRemove = async (id) => {
    if (!id || removingId) return;

    try {
      setRemovingId(id);
      await toggleWishlist?.(id);
      toast.success("Removed from wishlist");
    } catch {
      toast.error("Failed to remove item");
    } finally {
      setRemovingId(null);
    }
  };

  /* ---------------- AUTH GUARD ---------------- */
  if (!isAuthenticated) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen flex items-center justify-center px-4 bg-slate-50"
      >
        <div className="max-w-md w-full surface p-7 text-center">
          <div className="h-11 w-11 bg-black text-white rounded-lg flex items-center justify-center mx-auto mb-4">
            <Heart size={22} />
          </div>

          <h2 className="text-xl font-black uppercase tracking-tight mb-2">
            Login to view your wishlist
          </h2>

          <p className="text-sm text-gray-500 mb-6">
            Save products and access them anytime
          </p>

          <Button onClick={handleLogin} className="w-full">
            Login <ArrowRight size={16} />
          </Button>
        </div>
      </motion.div>
    );
  }

  /* ---------------- UI ---------------- */
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-slate-50 pb-20"
    >
      <div className="page-shell">
        {/* HEADER */}
        <div className="surface p-4 md:p-5 flex flex-col md:flex-row justify-between items-center mb-5 gap-4">
          <h1 className="page-title">
            My Wishlist ({safeItems.length})
          </h1>

          <Link
            to="/collection"
            className="btn-luxury-outline h-11 px-5"
          >
            Browse Products <ArrowRight size={14} />
          </Link>
        </div>

        {/* LOADING */}
        {isLoading && (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 border-2 border-gray-200 border-t-black animate-spin rounded-full" />
          </div>
        )}

        {/* EMPTY */}
        {!isLoading && safeItems.length === 0 && (
          <div className="empty-state">
            <Heart size={40} className="mx-auto text-gray-300 mb-4" />

            <h2 className="text-lg font-black uppercase tracking-tight">
              Your wishlist is empty
            </h2>

            <p className="text-gray-500 mt-2 mb-6">
              Save products you like to see them here
            </p>

            <Button onClick={() => navigate("/collection")}>
              Start Shopping <ArrowRight size={16} />
            </Button>
          </div>
        )}

        {/* PRODUCTS */}
        {!isLoading && safeItems.length > 0 && (
          <div className="product-grid-compact">
            {safeItems.map((product, index) => {
              const id = product.id || product._id || product.productId;

              return (
                <div
                  key={id || `wishlist-product-${index}`}
                  className="relative group"
                >
                  <ProductCard product={product} />

                  {id && (
                    <button
                      type="button"
                      aria-label="Remove from wishlist"
                      onClick={() => handleRemove(id)}
                      disabled={removingId === id}
                      className="absolute top-2 right-2 bg-white border border-slate-200 rounded-full p-2 shadow hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
