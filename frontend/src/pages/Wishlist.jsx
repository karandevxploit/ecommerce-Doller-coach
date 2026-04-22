import { Heart, ArrowRight, Trash2 } from "lucide-react";
import Button from "../components/ui/Button";
import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuthStore, useWishlistStore } from "../store";
import ProductCard from "../components/ProductCard";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

export default function Wishlist() {
  const navigate = useNavigate();

  const { isAuthenticated } = useAuthStore();
  const {
    items = [],
    isLoading,
    toggleWishlist,
    fetchWishlist,
  } = useWishlistStore();

  useEffect(() => {
    if (isAuthenticated) {
      fetchWishlist();
    }
  }, [isAuthenticated, fetchWishlist]);

  const handleRemove = (id) => {
    try {
      toggleWishlist(id);
      toast.success("Removed from wishlist");
    } catch {
      toast.error("Failed to remove item");
    }
  };

  /* ---------------- AUTH GUARD ---------------- */
  if (!isAuthenticated) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen flex items-center justify-center px-4 bg-gray-50"
      >
        <div className="max-w-md w-full bg-white border rounded-2xl p-8 text-center shadow-sm">
          <div className="h-12 w-12 bg-black text-white rounded-lg flex items-center justify-center mx-auto mb-4">
            <Heart size={22} />
          </div>

          <h2 className="text-xl font-semibold mb-2">
            Login to view your wishlist
          </h2>

          <p className="text-sm text-gray-500 mb-6">
            Save products and access them anytime
          </p>

          <Button
            onClick={() => navigate("/login")}
            className="w-full"
          >
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
      className="min-h-screen bg-white pb-20"
    >
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 border-b pb-4 gap-4">
          <h1 className="text-2xl font-semibold">
            My Wishlist ({items.length})
          </h1>

          <Link
            to="/collection"
            className="text-sm border px-4 py-2 rounded-lg flex items-center gap-2"
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
        {!isLoading && items.length === 0 && (
          <div className="text-center py-20">
            <Heart
              size={40}
              className="mx-auto text-gray-300 mb-4"
            />

            <h2 className="text-lg font-semibold">
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
        {!isLoading && items.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((p) => (
              <div
                key={p.id}
                className="relative group"
              >
                <ProductCard product={p} />

                <button
                  aria-label="Remove from wishlist"
                  onClick={() => handleRemove(p.id)}
                  className="absolute top-2 right-2 bg-white border rounded-full p-2 shadow hover:bg-gray-100"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}