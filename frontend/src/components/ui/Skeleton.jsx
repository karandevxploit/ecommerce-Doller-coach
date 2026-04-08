import { motion } from "framer-motion";

// 🔥 Shimmer Base
export const Skeleton = ({ className }) => {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gray-50 border border-gray-100 ${className}`}>
      {/* Premium Shimmer Effect */}
      <motion.div
        className="absolute inset-0"
        initial={{ x: "-100%" }}
        animate={{ x: "100%" }}
        transition={{
          repeat: Infinity,
          duration: 1.8,
          ease: "easeInOut",
        }}
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(238, 242, 255, 0.8), transparent)",
        }}
      />
    </div>
  );
};

// 🛍 Product Card Skeleton
export const ProductCardSkeleton = () => (
  <div className="flex flex-col h-full bg-[#f1f5f9] rounded-xl overflow-hidden border border-gray-100 p-3">
    
    <Skeleton className="aspect-[4/5] rounded-lg" />

    <div className="mt-3 space-y-2">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-4 w-full" />

      <div className="flex justify-between pt-2">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-3 w-10" />
      </div>
    </div>
  </div>
);

// 🏷 Category Skeleton
export const CategorySkeleton = () => (
  <div className="relative rounded-xl overflow-hidden bg-[#f1f5f9] border border-gray-100 aspect-[4/5] p-3 flex flex-col justify-end">
    
    <Skeleton className="h-4 w-20 mb-2" />
    <Skeleton className="h-3 w-12" />
  </div>
);

// 🧾 Order Summary Skeleton
export const OrderSummarySkeleton = () => (
  <div className="p-3 rounded-2xl bg-[#111118] border border-white/10 space-y-6">

    <Skeleton className="h-4 w-32" />

    <div className="space-y-3">
      <div className="flex justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="flex justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>

    <div className="h-px bg-white/5" />

    <div className="space-y-2">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-10 w-32" />
    </div>

    <Skeleton className="h-12 w-full" />
  </div>
);