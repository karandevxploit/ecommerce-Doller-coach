import { useMemo } from "react";
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
  onRetry,
}) {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();

  const isGrid = viewMode === "grid";

  const safeProducts = useMemo(() => {
    if (!Array.isArray(products)) return [];

    return Array.from(
      new Map(
        products
          .filter((product) => product && typeof product === "object")
          .map((product) => [
            String(product?._id || product?.id || product?.slug || product?.name || product?.title),
            product,
          ])
      ).values()
    );
  }, [products]);

  const containerClass = isGrid
    ? "grid grid-cols-2 md:grid-cols-5 xl:grid-cols-6 gap-2.5"
    : "flex flex-col gap-4";

  /* ---------------- LOADING ---------------- */
  if (loading) {
    return (
      <div
        className={
          isGrid
            ? "grid grid-cols-2 md:grid-cols-5 xl:grid-cols-6 gap-2.5"
            : "space-y-4"
        }
      >
        {Array.from({ length: 8 }).map((_, index) => (
          <ProductCardSkeleton
            key={`product-skeleton-${index}`}
            horizontal={!isGrid}
          />
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
          type="button"
          onClick={onRetry}
          disabled={!onRetry}
          className="mt-4 flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCcw size={14} />
          Retry
        </button>
      </div>
    );
  }

  /* ---------------- EMPTY ---------------- */
  if (!safeProducts.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center bg-slate-50 rounded-xl border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-900">
          No products found
        </h3>

        <p className="text-sm text-slate-500 mt-1 max-w-xs">
          Try changing filters or explore all products.
        </p>

        <button
          type="button"
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
    <div className={containerClass}>
      <AnimatePresence mode="popLayout">
        {safeProducts.map((product, index) => {
          const productId = product?._id || product?.id || product?.slug;
          const key = productId
            ? String(productId)
            : `product-${index}-${product?.title || product?.name || "item"}`;

          return (
            <motion.div
              key={key}
              layout
              initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.95 }}
              transition={{
                duration: prefersReducedMotion ? 0 : 0.25,
                delay: prefersReducedMotion ? 0 : Math.min(index * 0.03, 0.24),
              }}
            >
              <ProductCard
                product={product}
                layout={isGrid ? "vertical" : "horizontal"}
                priority={index < 4}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
