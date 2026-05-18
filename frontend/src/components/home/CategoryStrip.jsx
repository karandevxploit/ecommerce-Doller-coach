import { Link } from "react-router-dom";
import {
  Shirt,
  Watch,
  Footprints,
  ShoppingBag,
  Sparkles,
  User,
  Heart,
  TrendingUp,
} from "lucide-react";

const ICONS = {
  men: User,
  women: Heart,
  new: Sparkles,
  sale: Footprints,
  accessories: Watch,
  streetwear: Shirt,
  catalog: ShoppingBag,
  "best sellers": TrendingUp,
  "new arrivals": Sparkles,
};

const getCategoryName = (category) => {
  return String(category?.name || category?.label || category?.title || "Category");
};

const getCategoryPath = (category) => {
  const path = category?.path || category?.href || category?.url;
  return typeof path === "string" && path.trim() ? path : "/";
};

const getCategoryKey = (category, index) => {
  return String(category?.id || category?._id || category?.slug || `${getCategoryName(category)}-${index}`);
};

export default function CategoryStrip({ categories = [] }) {
  const safeCategories = Array.isArray(categories) ? categories.filter(Boolean) : [];

  if (safeCategories.length === 0) return null;

  return (
    <section className="py-4 md:py-8 bg-white border-b border-gray-100 overflow-x-auto no-scrollbar">
      <div className="container-responsive flex items-center justify-start md:justify-center gap-3 md:gap-16 min-w-max md:min-w-0">
        {safeCategories.map((category, index) => {
          const name = getCategoryName(category);
          const iconKey = name.toLowerCase();
          const Icon = ICONS[iconKey] || Shirt;

          return (
            <Link
              key={getCategoryKey(category, index)}
              to={getCategoryPath(category)}
              aria-label={name}
              className="group flex flex-col items-center shrink-0 w-20 md:w-24 transition-all duration-300 transform hover:-translate-y-1"
            >
              <div className="relative w-11 h-11 md:w-16 md:h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 transition-all duration-300 group-hover:bg-slate-900 group-hover:text-white group-hover:shadow-xl group-hover:scale-110 group-hover:border-slate-900">
                <Icon
                  size={20}
                  className="transition-transform duration-300 group-hover:scale-110"
                />
              </div>

              <span className="mt-2 md:mt-4 text-[10px] md:text-xs font-semibold uppercase tracking-wider text-slate-500 group-hover:text-slate-900 transition-colors duration-300 text-center">
                {name}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
