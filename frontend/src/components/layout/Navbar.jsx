import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore, useCartStore } from "@/store";
import {
  ShoppingCart,
  User,
  LogOut,
  Search,
  ChevronDown,
  Sparkles,
  Heart,
  Menu,
  X,
} from "lucide-react";
import Button from "../ui/Button";
import NotificationsDropdown from "../NotificationsDropdown";
import { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useConfigStore } from "@/store/configStore";

export default function Navbar() {
  const user = useAuthStore(state => state.user);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const logout = useAuthStore(state => state.logout);

  const config = useConfigStore(state => state.config);
  const fetchConfig = useConfigStore(state => state.fetchConfig);

  useEffect(() => {
    if (!config) fetchConfig();
  }, [config, fetchConfig]);
  const { items } = useCartStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const [prevLocation, setPrevLocation] = useState(location);
  if (location !== prevLocation) {
    setPrevLocation(location);
    setIsMobileMenuOpen(false);
  }

  const cartCount = useMemo(() => items?.length || 0, [items]);
  const initials = useMemo(() => user?.name?.[0]?.toUpperCase() || "U", [user]);

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setQuery("");
      setIsMobileMenuOpen(false);
    }
  };

  const navLinks = [
    { name: "MEN", path: "/collection?category=MEN" },
    { name: "WOMEN", path: "/collection?category=WOMEN" },
    { name: "Trending", path: "/collection?trending=true" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-[100] transition-all duration-300">
      <div
        className={`w-full transition-all duration-300 border-b ${isScrolled
          ? "bg-white/95 backdrop-blur-md border-gray-100 shadow-sm py-2"
          : "bg-white border-transparent py-3 md:py-4"
          }`}
      >
        <div className="max-w-[1400px] mx-auto px-4 md:px-10 flex items-center justify-between">

          {/* Brand Iduser */}
          <div
            onClick={() => navigate("/")}
            className="flex items-center gap-3 relative group cursor-pointer z-10"
          >
            {config?.logo ? (
              <img src={config.logo} alt="brand" className="h-9 md:h-8 w-auto object-contain transition-all duration-300" />
            ) : (
              <div className="relative h-9 w-9 md:h-8 md:w-8 flex items-center justify-center rounded-lg bg-[#0f172a] text-white shadow-sm transition-all duration-300">
                <span className="text-sm font-black italic">D</span>
              </div>
            )}
            <div className="flex flex-col">
              <h1 className="text-xl md:text-2xl font-black tracking-tighter text-[#1e3a8a] uppercase leading-none">
                DOLLER <span className="text-[#0f172a]">Coach</span>
              </h1>
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-400 mt-1 group-hover:text-[#0f172a] transition-colors">
                (By Gangwani and Company)
              </p>
            </div>
          </div>

          {/* Core Navigation Links */}
          <div className="hidden lg:flex items-center gap-5">
            {navLinks.map((link) => {
              const isActive = location.pathname + location.search === link.path || location.pathname === link.path && !link.path.includes("?");
              return (
                <button
                  key={link.name}
                  onClick={() => navigate(link.path)}
                  className="relative group text-[10px] font-black uppercase tracking-[0.2em] text-[#0f172a]/50 hover:text-[#0f172a] transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 rounded-md px-2 py-1"
                >
                  {link.name}
                  <span className={`absolute -bottom-1.5 left-0 h-0.5 bg-[#0f172a] transition-all duration-300 rounded-full ${isActive ? "w-full" : "w-0 group-hover:w-full"
                    }`} />
                </button>
              );
            })}
          </div>

          {/* Dynamic Search Interface */}
          <form
            onSubmit={handleSearch}
            className="hidden md:flex flex-1 max-w-[240px] lg:max-w-xs mx-8 relative"
          >
            <div className="relative w-full group">
              <Search
                size={14}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-[#0f172a] transition-colors"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                className="w-full h-9 pl-11 pr-4 rounded-lg bg-[#f1f5f9] border border-transparent text-[#111111] font-bold uppercase tracking-widest text-[10px] focus:bg-white focus:ring-4 focus:ring-[#0f172a]/5 focus:border-[#0f172a]/30 outline-none transition-all placeholder:text-gray-300 shadow-inner"
              />
            </div>
          </form>

          {/* User & Cart Interactions (Visible only from tablets/desktop up) */}
          <div className="hidden md:flex items-center gap-3 z-10">
            <Button
              variant="icon"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden"
            >
              {isMobileMenuOpen ? <X size={26} strokeWidth={2.5} /> : <Menu size={26} strokeWidth={2.5} />}
            </Button>

            {isAuthenticated ? (
              <div className="flex items-center gap-2 md:gap-5">
                <div className="hidden sm:block">
                  <NotificationsDropdown />
                </div>

                <Button
                  variant="icon"
                  onClick={() => navigate("/wishlist")}
                >
                  <Heart size={18} strokeWidth={2.5} />
                </Button>

                <Button
                  variant="icon"
                  onClick={() => navigate("/cart")}
                  className="relative"
                >
                  <ShoppingCart size={18} strokeWidth={2.5} />
                  {cartCount > 0 && (
                    <span className="absolute top-1 right-1 h-4 min-w-[16px] px-1 flex items-center justify-center text-[8px] bg-[#0f172a] text-white rounded-full font-black">
                      {cartCount}
                    </span>
                  )}
                </Button>

                {/* Account User Profile */}
                <div className="relative ml-1">
                  <Button
                    variant="icon"
                    onClick={() => setIsProfileOpen(prev => !prev)}
                    className="flex items-center gap-2 p-1 rounded-lg hover:bg-[#f1f5f9] transition-all shadow-none cursor-pointer"
                  >
                    <div className="h-8 w-8 rounded-lg bg-[#0f172a] text-white flex items-center justify-center font-black text-[10px] shadow-md">
                      {initials}
                    </div>
                    <ChevronDown size={12} className={`text-gray-300 transition-all ${isProfileOpen ? "rotate-180 text-[#0f172a]" : ""}`} />
                  </Button>

                  {isProfileOpen && (
                    <div className="absolute right-0 mt-4 w-64 bg-white border border-[#F2F2F2] rounded-3xl shadow-xl z-[110] overflow-hidden animate-in fade-in slide-in-from-top-3 duration-300">
                      <div className="p-5 bg-[#f1f5f9]/50 text-[10px] font-black text-gray-300 uppercase tracking-[0.3em]">
                        Security Clearances
                      </div>
                      <div className="p-3 border-b border-[#F2F2F2]">
                        <p className="text-sm font-black text-[#0f172a] leading-none truncate">{user?.name?.toUpperCase()}</p>
                        <p className="text-[10px] text-gray-400 font-bold tracking-widest truncate mt-2">{user?.email}</p>
                      </div>

                      <div className="p-3">
                        <Button
                          variant="primary"
                          onClick={() => {
                            navigate("/profile");
                            setIsProfileOpen(false);
                          }}
                          className="w-full text-sm mb-2"
                        >
                          <User size={18} /> Profile Studio
                        </Button>

                        <Button
                          variant="outline"
                          onClick={() => {
                            logout();
                            setIsProfileOpen(false);
                          }}
                          className="w-full text-sm"
                        >
                          <LogOut size={18} /> Sign Out
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <Button
                variant="primary"
                onClick={() => navigate("/login")}
                className="text-sm"
              >
                Access Hub
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Interaction Space */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden absolute left-0 right-0 top-full mt-3 mx-6 p-8 rounded-[2.5rem] bg-white border border-gray-100 shadow-sm z-[90]"
          >
            <form onSubmit={handleSearch} className="mb-8 relative">
              <Search size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="MANIFEST SEARCH"
                className="w-full h-16 pl-14 pr-6 rounded-3xl bg-[#f1f5f9] border border-transparent text-[#111111] font-black uppercase tracking-widest text-[12px] focus:ring-4 focus:ring-[#0f172a]/10 focus:border-[#0f172a]"
              />
            </form>

            <div className="flex flex-col gap-3">
              {navLinks.map((link) => (
                <Button
                  variant="secondary"
                  key={link.name}
                  onClick={() => navigate(link.path)}
                  className="w-full justify-between"
                >
                  <span className="text-[#0f172a] font-bold">{link.name}</span>
                  <ChevronDown size={18} className="-rotate-90 text-gray-400 transition-all" />
                </Button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}