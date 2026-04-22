import { useNavigate, NavLink } from "react-router-dom";
import { useAuthStore, useCartStore } from "@/store";
import {
  ShoppingCart,
  User,
  Search,
  Menu,
  X,
  ChevronRight,
  LogOut
} from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SafeText from "@/components/common/SafeText";
import { useSiteContentStore } from "@/store/siteContentStore";
import logo from "@/assets/logo.png";

const NAV_LINKS = [
  { label: "Home", path: "/", end: true },
  { label: "Men", path: "/collection/men" },
  { label: "Women", path: "/collection/women" },
  { label: "New", path: "/collection/new-arrivals" },
  { label: "Collections", path: "/collection/featured" },
  { label: "Sale", path: "/category/sale" }
];

export default function Navbar({ onCartClick }) {
  const { user, logout, isAuthenticated, openAuthModal } = useAuthStore();
  const { cart } = useCartStore();
  const { content, previewContent, isPreviewMode } = useSiteContentStore();

  const activeContent = isPreviewMode ? previewContent : content;
  const navigate = useNavigate();

  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 8);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const cartCount = useMemo(() => {
    if (!Array.isArray(cart)) return 0;
    return cart.reduce((acc, item) => acc + (item?.quantity || 0), 0);
  }, [cart]);

  const userInitial = user?.name?.charAt(0)?.toUpperCase() || "U";
  const userImage = user?.picture || user?.avatar || user?.image;

  return (
    <>
      {/* NAVBAR */}
      <nav
        role="navigation"
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 min-h-[70px] flex items-center border-b ${isScrolled
            ? "bg-white/95 backdrop-blur-lg shadow-sm py-2"
            : "bg-white py-3"
          }`}
      >
        <div className="container-responsive flex items-center justify-between w-full h-full relative">

          {/* LEFT: DESKTOP NAV & MOBILE MENU */}
          <div className="flex-1 flex items-center justify-start">
            {/* MOBILE MENU TOGGLE */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
              className="lg:hidden p-2 -ml-2 rounded-md hover:bg-slate-100 transition text-black"
            >
              <Menu size={24} />
            </button>

            {/* DESKTOP NAV */}
            <div className="hidden lg:flex items-center gap-8">
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.path}
                  to={link.path}
                  end={link.end}
                  className={({ isActive }) =>
                    `text-[11px] font-bold uppercase tracking-[0.15em] transition ${isActive
                      ? "text-black"
                      : "text-slate-500 hover:text-black"
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </div>
          </div>

          {/* CENTER: LOGO */}
          <div className="flex-shrink-0 flex justify-center items-center absolute left-1/2 -translate-x-1/2">
            <button
              onClick={() => navigate("/")}
              aria-label="Go to homepage"
              className="flex items-center gap-3 group"
            >
              <img
                src={activeContent?.branding?.logo?.url || logo}
                alt="Brand logo"
                className="h-10 md:h-12 object-contain transition-transform group-hover:scale-105"
                onError={(e) => (e.currentTarget.src = logo)}
              />
              <span className="hidden sm:block text-xl md:text-2xl font-black uppercase tracking-tighter text-black">
                DOLLER COACH
              </span>
            </button>
          </div>

          {/* RIGHT: ACTIONS */}
          <div className="flex-1 flex items-center justify-end gap-3 sm:gap-5">

            {/* SEARCH */}
            <button
              onClick={() => navigate("/search")}
              aria-label="Search products"
              className="p-2 text-black rounded-md hover:bg-slate-100 transition"
            >
              <Search size={20} strokeWidth={2.5} />
            </button>

            {/* CART */}
            <button
              onClick={onCartClick}
              aria-label="Open cart"
              className="relative p-2 text-black rounded-md hover:bg-slate-100 transition"
            >
              <ShoppingCart size={20} strokeWidth={2.5} />
              {cartCount > 0 && (
                <span className="absolute 0 right-0 bg-black text-white text-[10px] font-bold h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center -translate-y-1 tranlate-x-1 border-2 border-white">
                  {cartCount}
                </span>
              )}
            </button>

            {/* USER / AUTH */}
            {isAuthenticated ? (
              <button
                onClick={() => navigate("/profile")}
                aria-label="Profile"
                className="h-9 w-9 overflow-hidden rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center transition hover:ring-2 hover:ring-black hover:border-black"
              >
                {userImage ? (
                  <img src={userImage} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-bold text-black">{userInitial}</span>
                )}
              </button>
            ) : (
              <button
                onClick={openAuthModal}
                aria-label="Login"
                className="hidden sm:block px-6 py-2.5 bg-black text-white text-[11px] font-bold uppercase tracking-widest transition-colors hover:bg-slate-800"
              >
                Login
              </button>
            )}

            {/* MOBILE LOGIN FALLBACK - So they can login on mobile without opening drawer if not using user icon */}
            {!isAuthenticated && (
              <button
                onClick={openAuthModal}
                aria-label="Login"
                className="sm:hidden p-2 text-black hover:bg-slate-100 transition rounded-md ml-1"
              >
                <User size={20} strokeWidth={2.5} />
              </button>
            )}

          </div>

        </div>
      </nav>

      {/* MOBILE DRAWER */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* OVERLAY */}
            <motion.div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
            />

            {/* DRAWER */}
            <motion.aside
              role="dialog"
              aria-label="Mobile menu"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ ease: "easeInOut", duration: 0.3 }}
              className="fixed top-0 left-0 bottom-0 w-[85%] max-w-sm bg-white z-[101] flex flex-col shadow-2xl"
            >
              {/* HEADER */}
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <span className="text-xl font-black uppercase tracking-tight text-black">
                  MENU
                </span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close menu"
                  className="p-2 text-slate-400 hover:text-black transition"
                >
                  <X size={24} />
                </button>
              </div>

              {/* LINKS */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {NAV_LINKS.map((link) => (
                  <NavLink
                    key={link.path}
                    to={link.path}
                    end={link.end}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center justify-between text-lg font-bold uppercase tracking-widest ${isActive
                        ? "text-black"
                        : "text-slate-400 hover:text-black transition-colors"
                      }`
                    }
                  >
                    <span>{link.label}</span>
                    <ChevronRight size={20} strokeWidth={3} className={isActive ? "opacity-100" : "opacity-0"} />
                  </NavLink>
                ))}
              </div>

              {/* USER SECTION */}
              <div className="p-6 border-t border-slate-100 bg-slate-50">
                {isAuthenticated ? (
                  <div className="flex items-center justify-between bg-white p-4 rounded border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 overflow-hidden rounded-full border border-slate-200 bg-slate-100 flex items-center justify-center">
                        {userImage ? (
                          <img src={userImage} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-bold text-black">{userInitial}</span>
                        )}
                      </div>
                      <div>
                        <SafeText className="text-sm font-bold text-black block tracking-wide uppercase">
                          {user?.name || "User"}
                        </SafeText>
                        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
                          My Account
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={logout}
                      aria-label="Logout"
                      className="p-2 text-red-500 hover:bg-red-50 rounded transition"
                    >
                      <LogOut size={20} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      openAuthModal();
                      setMobileMenuOpen(false);
                    }}
                    className="w-full py-4 bg-black text-white text-xs font-bold uppercase tracking-widest transition-colors hover:bg-slate-800"
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