import { Link } from "react-router-dom";
import NotificationsDropdown from "../NotificationsDropdown";
import { useAuthStore } from "../../store";
import { ShoppingBag } from "lucide-react";

export default function MobileHeader({ onCartClick }) {
  const { isAuthenticated } = useAuthStore();

  return (
    <header
      className="md:hidden sticky top-0 z-50 px-3 pt-3"
      role="banner"
    >
      {/* Floating Header */}
      <div className="flex items-center justify-between h-14 px-3 rounded-xl bg-white border border-gray-100 shadow-sm">

        {/* Brand */}
        <Link
          to="/"
          aria-label="Go to homepage"
          className="flex items-center gap-2 min-w-0"
        >
          {/* Logo */}
          <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-slate-900 text-white font-bold text-sm shadow-sm">
            D
          </div>

          {/* Text */}
          <div className="flex flex-col leading-none truncate">
            <span className="text-sm font-extrabold text-indigo-700 uppercase tracking-tight truncate">
              Doller <span className="text-slate-900">Coach</span>
            </span>
            <span className="text-[8px] text-gray-400 tracking-wide truncate">
              Fashion Store
            </span>
          </div>
        </Link>

        {/* Right Side */}
        <div className="flex items-center gap-2">

          {/* Notifications */}
          {isAuthenticated && (
            <div className="scale-90">
              <NotificationsDropdown />
            </div>
          )}

          {/* Cart Button */}
          <button
            onClick={onCartClick}
            aria-label="Open cart"
            className="relative flex items-center justify-center h-9 w-9 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition active:scale-95"
          >
            <ShoppingBag size={18} className="text-slate-700" />

            {/* Future: badge count */}
            {/* <span className="absolute -top-1 -right-1 text-[10px] bg-indigo-600 text-white rounded-full px-1.5">2</span> */}
          </button>

        </div>
      </div>
    </header>
  );
}