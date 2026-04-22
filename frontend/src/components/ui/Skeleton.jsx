import { motion, useReducedMotion } from "framer-motion";

/**
 * Base Skeleton
 * Lightweight, accessible, reusable
 */
export const Skeleton = ({
  className = "",
  rounded = "rounded-lg"
}) => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      className={`relative overflow-hidden bg-slate-100 border border-slate-200 ${rounded} ${className}`}
      aria-busy="true"
      aria-live="polite"
    >
      {!prefersReducedMotion && (
        <motion.div
          className="absolute inset-0"
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{
            repeat: Infinity,
            duration: 1.2,
            ease: "linear"
          }}
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)"
          }}
        />
      )}
    </div>
  );
};

/* ---------------- PRODUCT CARD ---------------- */

export const ProductCardSkeleton = ({ horizontal = false }) => (
  <div
    className={`flex bg-white rounded-xl overflow-hidden border border-slate-200 p-3 ${horizontal
        ? "flex-row gap-4 h-32 md:h-44"
        : "flex-col"
      }`}
  >
    <Skeleton
      className={
        horizontal
          ? "w-24 md:w-40 h-full shrink-0"
          : "aspect-[4/5]"
      }
      rounded="rounded-md"
    />

    <div className={`flex-1 space-y-2 ${horizontal ? "py-1" : "mt-3"}`}>
      <div className="flex justify-between">
        <Skeleton className="h-3 w-16" />
        {horizontal && <Skeleton className="h-3 w-10" />}
      </div>

      <Skeleton className="h-4 w-3/4" />
      {horizontal && <Skeleton className="h-3 w-full" />}

      <div className="flex justify-between pt-2">
        <Skeleton className="h-4 w-20" />
        {!horizontal && <Skeleton className="h-3 w-10" />}
      </div>
    </div>
  </div>
);

/* ---------------- HERO ---------------- */

export const HeroSkeleton = () => (
  <div className="relative w-full h-[60vh] md:h-[70vh] bg-slate-50 flex items-center">
    <div className="max-w-6xl mx-auto w-full grid md:grid-cols-2 gap-8 px-6">

      <div className="space-y-5">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-4 w-2/3" />

        <div className="flex gap-3 pt-3">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-28" />
        </div>

        <Skeleton className="h-10 w-40" />
      </div>

      <Skeleton className="aspect-square w-full rounded-2xl" />
    </div>
  </div>
);

/* ---------------- CATEGORY ---------------- */

export const CategorySkeleton = () => (
  <div className="rounded-xl border border-slate-200 bg-white p-3 flex flex-col justify-end aspect-[4/5]">
    <Skeleton className="h-4 w-20 mb-2" />
    <Skeleton className="h-3 w-12" />
  </div>
);

/* ---------------- ORDER SUMMARY ---------------- */

export const OrderSummarySkeleton = () => (
  <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-5">
    <Skeleton className="h-4 w-32" />

    <div className="space-y-2">
      <div className="flex justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="flex justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>

    <div className="h-px bg-slate-100" />

    <Skeleton className="h-10 w-full" />
  </div>
);