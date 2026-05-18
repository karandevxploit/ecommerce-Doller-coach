import { useNavigate, NavLink, useLocation } from "react-router-dom";
import { useAuthStore, useCartStore } from "@/store";
import {
  ShoppingCart,
  User,
  Search,
  Menu,
  X,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { useMemo, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSiteContentStore } from "@/store/siteContentStore";
import logo from "@/assets/logo.png";
import SafeImage from "../ui/SafeImage";

const NAV_LINKS = [
  { label: "Home", path: "/", end: true },
  { label: "Men", path: "/collection/men" },
  { label: "Women", path: "/collection/women" },
  { label: "New", path: "/collection/new-arrivals" },
  { label: "Sale", path: "/collection/hot-sale" },
];

const safeQuantity = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const formatCartCount = (count) => {
  return count > 99 ? "99+" : count;
};

export default function Navbar({ onCartClick = () => { } }) {
  const { user, logout, isAuthenticated, openAuthModal } = useAuthStore();
  const { cart = [] } = useCartStore();
  const { content, previewContent, isPreviewMode } = useSiteContentStore();

  const activeContent = isPreviewMode ? previewContent : content;
  const navigate = useNavigate();
  const location = useLocation();

  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  const openMobileMenu = useCallback(() => {
    setMobileMenuOpen(true);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 8);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    closeMobileMenu();
  }, [location.pathname, closeMobileMenu]);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeMobileMenu();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen, closeMobileMenu]);

  const cartCount = useMemo(() => {
    if (!Array.isArray(cart)) return 0;

    return cart.reduce((acc, item) => acc + safeQuantity(item?.quantity), 0);
  }, [cart]);

  const userInitial = user?.name?.charAt(0)?.toUpperCase() || "U";
  const userImage = user?.picture || user?.avatar || user?.image || "";
  const logoUrl =
    activeContent?.branding?.logo?.url ||
    activeContent?.branding?.logo?.secure_url ||
    activeContent?.branding?.logo?.secureUrl ||
    activeContent?.branding?.logo?.imageUrl ||
    logo;

  const handleLogout = () => {
    logout();
    closeMobileMenu();
  };

  const handleAuthOpen = () => {
    openAuthModal();
    closeMobileMenu();
  };

  return (
    <>
      <nav
        role="navigation"
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 h-[70px] flex items-center border-b ${isScrolled ? "bg-white/95 backdrop-blur-lg shadow-md" : "bg-white"
          } h-[64px] md:h-[68px]`}
      >
        <div className="container-responsive flex items-center justify-between w-full h-full relative">
          <div className="flex-1 flex items-center justify-start h-full">
            <button
              type="button"
              onClick={openMobileMenu}
              aria-label="Open menu"
              className="lg:hidden p-2 rounded-md hover:bg-slate-100 transition text-black"
            >
              <Menu size={24} />
            </button>

            <div className="hidden lg:flex items-center gap-7 h-full">
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.path}
                  to={link.path}
                  end={link.end}
                  className={({ isActive }) =>
                    `text-[11px] font-bold uppercase tracking-[0.15em] transition whitespace-nowrap ${isActive ? "text-black" : "text-slate-500 hover:text-black"
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </div>
          </div>

          <div className="flex-shrink-0 flex justify-center items-center absolute left-1/2 -translate-x-1/2 h-full">
            <button
              type="button"
              onClick={() => navigate("/")}
              aria-label="Go to homepage"
              className="flex items-center gap-2.5 group whitespace-nowrap"
            >
              <div className="h-9 w-9 md:h-11 md:w-11 flex items-center justify-center overflow-hidden">
                <SafeImage
                  src={logoUrl}
                  alt="Brand logo"
                  className="max-h-full max-w-full object-contain transition-transform group-hover:scale-105"
                />
              </div>
              <div className="hidden sm:flex flex-col items-start justify-center text-left leading-none">
                <span className="text-lg md:text-2xl font-black uppercase tracking-tighter text-black">
                  DOLLER COACH
                </span>
                <span className="text-[8px] md:text-[9px] font-medium italic text-slate-400 tracking-wider mt-1 uppercase">
                  by Gangwani and Company
                </span>
              </div>
            </button>
          </div>

          <div className="flex-1 flex items-center justify-end gap-3 sm:gap-4 h-full">
            <button
              type="button"
              onClick={() => navigate("/search")}
              aria-label="Search"
              className="p-2 text-black rounded-md hover:bg-slate-100 transition"
            >
              <Search size={20} strokeWidth={2.5} />
            </button>

            <button
              type="button"
              onClick={onCartClick}
              aria-label="Cart"
              className="relative p-2 text-black rounded-md hover:bg-slate-100 transition"
            >
              <ShoppingCart size={20} strokeWidth={2.5} />
              {cartCount > 0 && (
                <span className="absolute top-1 right-1 bg-black text-white text-[10px] font-bold h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center border-2 border-white">
                  {formatCartCount(cartCount)}
                </span>
              )}
            </button>

            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => navigate("/profile")}
                aria-label="Open profile"
                className="h-9 w-9 overflow-hidden rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center transition hover:ring-2 hover:ring-black"
              >
                {userImage ? (
                  <img
                    src={userImage}
                    alt={user?.name || "Profile"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-bold text-black">{userInitial}</span>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={openAuthModal}
                className="hidden sm:block px-5 py-2 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors"
              >
                Login
              </button>
            )}

            {!isAuthenticated && (
              <button
                type="button"
                onClick={openAuthModal}
                aria-label="Login"
                className="sm:hidden p-2 text-black hover:bg-slate-100 transition rounded-md"
              >
                <User size={20} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeMobileMenu}
            />

            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ ease: "easeInOut", duration: 0.3 }}
              className="fixed top-0 left-0 bottom-0 w-[85%] max-w-sm bg-white z-[101] flex flex-col shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-label="Mobile navigation"
            >
              <div className="flex items-center justify-between p-6 border-b">
                <span className="text-xl font-black uppercase text-black">MENU</span>
                <button
                  type="button"
                  onClick={closeMobileMenu}
                  aria-label="Close menu"
                  className="p-2 text-slate-400 hover:text-black"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {NAV_LINKS.map((link) => (
                  <NavLink
                    key={link.path}
                    to={link.path}
                    end={link.end}
                    onClick={closeMobileMenu}
                    className={({ isActive }) =>
                      `flex items-center justify-between text-lg font-bold uppercase tracking-widest ${isActive ? "text-black" : "text-slate-400"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span>{link.label}</span>
                        <ChevronRight
                          size={20}
                          strokeWidth={3}
                          className={isActive ? "opacity-100" : "opacity-0"}
                        />
                      </>
                    )}
                  </NavLink>
                ))}
              </div>

              <div className="p-6 border-t bg-slate-50">
                {isAuthenticated ? (
                  <div className="flex items-center justify-between bg-white p-4 rounded border shadow-sm">
                    <button
                      type="button"
                      onClick={() => {
                        navigate("/profile");
                        closeMobileMenu();
                      }}
                      className="flex items-center gap-3 min-w-0 text-left"
                    >
                      <div className="h-10 w-10 overflow-hidden rounded-full border bg-slate-100 flex items-center justify-center shrink-0">
                        {userImage ? (
                          <img
                            src={userImage}
                            alt={user?.name || "Profile"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="font-bold">{userInitial}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-bold block truncate">
                          {user?.name || "User"}
                        </span>
                        <span className="text-[10px] uppercase text-slate-400">
                          My Account
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={handleLogout}
                      aria-label="Logout"
                      className="p-2 text-red-500"
                    >
                      <LogOut size={20} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleAuthOpen}
                    className="w-full py-4 bg-black text-white text-xs font-bold uppercase tracking-widest"
                  >
                    Login / Register
                  </button>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
