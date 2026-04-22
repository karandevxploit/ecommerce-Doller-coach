import { ProductCardSkeleton } from "./ui/Skeleton";
import ProductCard from "./ProductCard";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { AlertCircle, RefreshCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ProductGrid({
  products = [],
  viewMode = "grid",
  loading = false,
  error = false,
  onRetry
}) {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();

  const isGrid = viewMode === "grid";

  /* ---------------- LOADING ---------------- */
  if (loading) {
    return (
      <div
        className={
          isGrid
            ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
            : "space-y-4"
        }
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <ProductCardSkeleton key={i} horizontal={!isGrid} />
        ))}
      </div>
    );
  }

  /* ---------------- ERROR ---------------- */
  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center py-16 text-center"
      >
        <div className="h-14 w-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
          <AlertCircle size={24} />
        </div>

        <h3 className="text-lg font-semibold text-slate-900">
          Something went wrong
        </h3>

        <p className="text-sm text-slate-500 mt-1 max-w-xs">
          We couldn’t load the products. Please try again.
        </p>

        <button
          onClick={onRetry}
          className="mt-4 flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
        >
          <RefreshCcw size={14} />
          Retry
        </button>
      </div>
    );
  }

  /* ---------------- EMPTY ---------------- */
  if (!products.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center bg-slate-50 rounded-xl border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-900">
          No products found
        </h3>

        <p className="text-sm text-slate-500 mt-1 max-w-xs">
          Try changing filters or explore all products.
        </p>

        <button
          onClick={() => navigate("/collection")}
          className="mt-4 px-5 py-2 bg-slate-900 text-white rounded-lg hover:bg-indigo-600 transition"
        >
          View all products
        </button>
      </div>
    );
  }

  /* ---------------- LIST ---------------- */
  return (
    <div
      className={
        isGrid
          ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
          : "flex flex-col gap-4"
      }
    >
      <AnimatePresence mode="popLayout">
        {products.map((product, idx) => {
          const key = String(product?._id || product?.id || idx);

          return (
            <motion.div
              key={key}
              layout
              initial={
                prefersReducedMotion ? false : { opacity: 0, y: 10 }
              }
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25, delay: idx * 0.03 }}
            >
              <ProductCard
                product={product}
                layout={isGrid ? "vertical" : "horizontal"}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}