import { Link, useLocation } from "react-router-dom";
import { Home, ShoppingBag, Package, User, LayoutGrid } from "lucide-react";
import { useCartStore } from "../../store";
import clsx from "clsx";
import { useMemo } from "react";

const safeQuantity = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const formatBadge = (count) => {
  if (count > 99) return "99+";
  return count;
};

const isActiveRoute = (pathname, to) => {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
};

export default function BottomNav({ onCartClick }) {
  const location = useLocation();
  const { cart = [] } = useCartStore();

  const cartCount = useMemo(() => {
    if (!Array.isArray(cart)) return 0;

    return cart.reduce((acc, item) => {
      return acc + safeQuantity(item?.quantity);
    }, 0);
  }, [cart]);

  const links = useMemo(
    () => [
      { to: "/", icon: Home, label: "Home" },
      { to: "/collection", icon: LayoutGrid, label: "Categories" },
      {
        to: "/cart",
        icon: ShoppingBag,
        label: "Cart",
        onClick: onCartClick,
        badge: cartCount,
      },
      { to: "/my-orders", icon: Package, label: "Orders" },
      { to: "/profile", icon: User, label: "Profile" },
    ],
    [cartCount, onCartClick]
  );

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-white border-t pb-safe shadow-sm">
      <div className="flex items-center justify-around h-16">
        {links.map(({ to, icon: Icon, label, onClick, badge = 0 }) => {
          const isActive = isActiveRoute(location.pathname, to);

          const content = (
            <div className="flex flex-col items-center gap-1">
              <div className="relative">
                <Icon
                  size={20}
                  className={clsx(
                    "transition",
                    isActive ? "text-black scale-110" : "text-gray-400"
                  )}
                />

                {badge > 0 && (
                  <span className="absolute -top-2 -right-2 min-w-[16px] h-4 px-[4px] flex items-center justify-center text-[9px] font-bold text-white bg-red-500 rounded-full">
                    {formatBadge(badge)}
                  </span>
                )}
              </div>

              <span
                className={clsx(
                  "text-[10px] transition",
                  isActive ? "text-black" : "text-gray-400"
                )}
              >
                {label}
              </span>
            </div>
          );

          if (to === "/cart" && typeof onClick === "function") {
            return (
              <button
                key={label}
                type="button"
                onClick={onClick}
                aria-label="Open cart"
                className="flex-1 py-2"
              >
                {content}
              </button>
            );
          }

          return (
            <Link
              key={label}
              to={to}
              aria-label={label}
              className="flex-1 py-2 text-center"
            >
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
