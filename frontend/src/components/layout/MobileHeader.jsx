import { Link } from "react-router-dom";
import NotificationsDropdown from "../NotificationsDropdown";
import { useAuthStore, useCartStore } from "../../store";
import { ShoppingBag } from "lucide-react";
import { useMemo } from "react";
import logo from "../../assets/logo.png";

const safeQuantity = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const formatBadge = (count) => {
  return count > 99 ? "99+" : count;
};

export default function MobileHeader({ onCartClick = () => { } }) {
  const { isAuthenticated } = useAuthStore();
  const { cart = [] } = useCartStore();

  const cartCount = useMemo(() => {
    if (!Array.isArray(cart)) return 0;

    return cart.reduce((total, item) => total + safeQuantity(item?.quantity), 0);
  }, [cart]);

  return (
    <header className="md:hidden sticky top-0 z-50 px-3 pt-3" role="banner">
      <div className="flex items-center justify-between h-14 px-3 rounded-xl bg-white border border-gray-100 shadow-sm">
        <Link
          to="/"
          aria-label="Go to homepage"
          className="flex items-center gap-2 min-w-0"
        >
          <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-white overflow-hidden shadow-sm">
            <img
              src={logo}
              alt="Doller Coach logo"
              className="h-full w-full object-contain"
            />
          </div>

          <div className="flex flex-col leading-none truncate">
            <span className="text-sm font-extrabold text-indigo-700 uppercase tracking-tight truncate">
              Doller <span className="text-slate-900">Coach</span>
            </span>
            <span className="text-[8px] text-gray-400 tracking-wide truncate">
              Fashion Store
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          {Boolean(isAuthenticated) && (
            <div className="scale-90">
              <NotificationsDropdown />
            </div>
          )}

          <button
            type="button"
            onClick={onCartClick}
            aria-label="Open cart"
            className="relative flex items-center justify-center h-9 w-9 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition active:scale-95"
          >
            <ShoppingBag size={18} className="text-slate-700" />

            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center text-[9px] font-bold bg-indigo-600 text-white rounded-full">
                {formatBadge(cartCount)}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
