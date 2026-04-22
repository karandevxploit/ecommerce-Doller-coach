import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  User,
  UserRound,
  TrendingUp,
  Sparkles,
  Star,
  Flame,
  Shirt,
  ShoppingBag,
  Zap
} from "lucide-react";

const ICON_MAP = {
  MEN: User,
  WOMEN: UserRound,
  TRENDING: TrendingUp,
  "NEW ARRIVALS": Sparkles,
  "BEST SELLERS": Star,
  "HOT DEALS": Flame,
  SWEATSHIRTS: Shirt,
  "T-SHIRTS": Shirt,
  ACCESSORIES: ShoppingBag,
  DEFAULT: Zap
};

const BASE_CATEGORIES = [
  { id: "men", name: "Men", path: "/collection?category=MEN", icon: "MEN" },
  { id: "women", name: "Women", path: "/collection?category=WOMEN", icon: "WOMEN" },
  { id: "trending", name: "Trending", path: "/collection?trending=true", icon: "TRENDING", badge: "HOT" },
  { id: "new", name: "New Arrivals", path: "/collection?sort=newest", icon: "NEW ARRIVALS", badge: "NEW" },
  { id: "best", name: "Best Sellers", path: "/collection?sort=popularity", icon: "BEST SELLERS" },
  { id: "deals", name: "Hot Deals", path: "/collection?deals=true", icon: "HOT DEALS", badge: "SALE" }
];

export default function CategorySlider({ categories = [], isLoading = false }) {
  const navigate = useNavigate();

  const safeCategories = Array.isArray(categories) ? categories : [];

  const displayCategories = [
    ...BASE_CATEGORIES,
    ...safeCategories.filter(
      (c) =>
        c?.name &&
        !BASE_CATEGORIES.some(
          (b) => b.name.toUpperCase() === c.name.toUpperCase()
        )
    )
  ];

  // Loading State
  if (isLoading) {
    return (
      <div className="w-full bg-white border-b border-slate-100 py-10">
        <div className="max-w-[1400px] mx-auto px-6 flex gap-6 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-3 animate-pulse">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-slate-200" />
              <div className="w-16 h-3 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty State
  if (!displayCategories.length) {
    return (
      <div className="w-full py-10 text-center text-sm text-slate-500">
        No categories available right now.
      </div>
    );
  }

  return (
    <div className="w-full bg-white border-b border-slate-100 py-10 md:py-14">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6">

        <div
          className="flex items-center lg:justify-center overflow-x-auto no-scrollbar snap-x snap-mandatory gap-6 md:gap-12 pb-4"
          role="navigation"
          aria-label="Product Categories"
        >
          {displayCategories.map((cat, idx) => {
            const name = cat?.name || "Category";
            const path = cat?.path || "/";
            const iconKey = (cat?.icon || name).toUpperCase();

            const IconComponent =
              ICON_MAP[iconKey] || ICON_MAP.DEFAULT;

            const hasBadge = Boolean(cat?.badge);

            return (
              <motion.button
                key={cat.id || idx}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate(path)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") navigate(path);
                }}
                aria-label={`Browse ${name}`}
                className="flex flex-col items-center gap-3 flex-shrink-0 snap-start group relative focus:outline-none"
              >
                {/* Icon */}
                <div className="relative">
                  <div className="w-20 h-20 md:w-24 md:h-24 flex items-center justify-center rounded-full bg-slate-50 border border-slate-100 shadow-sm transition-all duration-300 group-hover:bg-white group-hover:border-indigo-400 group-hover:shadow-md focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">

                    <IconComponent
                      size={idx < 6 ? 30 : 26}
                      strokeWidth={1.6}
                      className="text-slate-600 group-hover:text-indigo-600 transition"
                    />
                  </div>

                  {/* Badge */}
                  {hasBadge && (
                    <span
                      className={`absolute -top-1 -right-1 px-2 py-[2px] rounded-full text-[9px] font-bold uppercase tracking-wide shadow ${cat.badge === "NEW"
                          ? "bg-emerald-500 text-white"
                          : cat.badge === "HOT"
                            ? "bg-orange-500 text-white"
                            : "bg-rose-500 text-white"
                        }`}
                    >
                      {cat.badge}
                    </span>
                  )}
                </div>

                {/* Label */}
                <div className="flex flex-col items-center">
                  <span className="text-[11px] md:text-xs font-semibold uppercase tracking-wide text-slate-500 group-hover:text-slate-900 transition">
                    {name}
                  </span>

                  <span className="h-[2px] w-0 bg-indigo-600 rounded-full transition-all duration-300 group-hover:w-6" />
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Scroll Hint (Mobile UX improvement) */}
        <div className="mt-3 text-center text-xs text-slate-400 md:hidden">
          Swipe to explore more
        </div>
      </div>
    </div>
  );
}