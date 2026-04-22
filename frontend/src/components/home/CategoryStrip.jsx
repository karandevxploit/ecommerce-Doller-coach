import { Link } from "react-router-dom";
import {
  Shirt,
  Watch,
  Footprints,
  Glasses,
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

export default function CategoryStrip({ categories = [] }) {
  if (!categories.length) return null;

  return (
    <section className="py-10 bg-white border-b border-gray-100 overflow-x-auto no-scrollbar">
      <div className="container-responsive flex items-center justify-center gap-8 md:gap-16 min-w-max md:min-w-0">

        {categories.map((cat) => {
          const key = cat.id || cat.name;
          const iconKey = (cat.name || "").toLowerCase();
          const Icon = ICONS[iconKey] || Shirt;

          return (
            <Link
              key={key}
              to={cat.path || "/"}
              aria-label={cat.name}
              className="group flex flex-col items-center shrink-0 w-24 transition-all duration-300 transform hover:-translate-y-1"
            >
              {/* ICON WRAPPER */}
              <div className="relative w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 transition-all duration-300 group-hover:bg-slate-900 group-hover:text-white group-hover:shadow-xl group-hover:scale-110 group-hover:border-slate-900">
                <Icon size={24} className="transition-transform duration-300 group-hover:scale-110" />
              </div>

              {/* LABEL */}
              <span className="mt-4 text-xs font-medium uppercase tracking-wider text-slate-500 group-hover:text-slate-900 transition-colors duration-300 text-center">
                {cat.name || "Category"}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}