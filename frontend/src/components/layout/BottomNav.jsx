import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, ShoppingCart, Heart, User, Search, X, Package } from "lucide-react";
import { useCartStore } from "../../store";
import clsx from "clsx";
import { motion } from "framer-motion";
import { useMemo, useState, createElement } from "react";
import { modalTransition, fadeIn, snappyTransition } from "../../utils/motion";
import { AnimatePresence } from "framer-motion";

export default function BottomNav() {
  void motion;
  const location = useLocation();
  const { items } = useCartStore();
  const navigate = useNavigate();

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  const cartCount = useMemo(() => items?.length || 0, [items]);

  const links = [
    { to: "/", icon: Home },
    { to: "#search", icon: Search },
    { to: "/wishlist", icon: Heart },
    { to: "/cart", icon: ShoppingCart, badge: cartCount },
    { to: "/my-orders", icon: Package },
    { to: "/profile", icon: User },
  ];

  return (
    <>
      {/* Bottom Nav */}
      <motion.nav 
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="md:hidden fixed bottom-6 left-0 right-0 z-50 px-6"
      >
        <div className="mx-auto max-w-sm relative">
          <div className="relative flex justify-between items-center h-16 px-4 rounded-3xl bg-white/90 backdrop-blur-xl border border-white/20 shadow-2xl">

            {links.map(({ to, icon: Icon, badge }) => {
              const isSearch = to === "#search";
              const isActive = !isSearch && location.pathname === to;

              const content = (
                <div className="relative flex items-center justify-center w-full">

                  <motion.div
                    whileTap={{ scale: 0.9 }}
                    whileHover={{ scale: 1.05 }}
                    className={clsx(
                      "relative p-2 rounded-xl transition-colors duration-300",
                      isActive
                        ? "text-white"
                        : "text-gray-400 hover:text-[#0f172a]"
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="nav-pill"
                        className="absolute inset-0 bg-[#0f172a] rounded-xl -z-10 shadow-lg"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    
                    {createElement(Icon, {
                      size: 20,
                      className: clsx(
                        "transition-transform duration-300",
                        isActive && "scale-110"
                      ),
                    })}

                    {/* Badge */}
                    {badge > 0 && (
                      <span className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center text-[8px] font-black text-[#0f172a] bg-white rounded-full shadow-sm border border-gray-100">
                        {badge}
                      </span>
                    )}
                  </motion.div>
                </div>
              );

              if (isSearch) {
                return (
                  <button
                    key={to}
                    onClick={() => setSearchOpen(true)}
                    className="w-full"
                  >
                    {content}
                  </button>
                );
              }

              return (
                <Link key={to} to={to} className="w-full">
                  {content}
                </Link>
              );
            })}
          </div>
        </div>
      </motion.nav>

      {/* Search Modal */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div 
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-[60] bg-[#0f172a]/40 backdrop-blur-md flex items-start justify-center pt-10 px-4"
          >
            <motion.div 
              variants={modalTransition}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full max-w-sm bg-white rounded-3xl p-10 border border-gray-100 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)]"
            >
              <div className="flex justify-between items-center mb-8">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-[#0f172a] uppercase tracking-[0.3em] leading-none mb-4">Transmission Search</span>
                </div>
                <motion.button 
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSearchOpen(false)}
                >
                  <X size={20} className="text-gray-300 hover:text-black transition-colors" />
                </motion.button>
              </div>

              <div className="space-y-6">
                <div className="relative">
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search seasonal manifests..."
                    className="w-full px-6 py-4 text-sm font-bold rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-[#0f172a] outline-none transition-all placeholder:text-gray-200"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setSearchOpen(false);
                        navigate(`/search?q=${query}`);
                      }
                    }}
                  />
                  <Search size={18} className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-200" />
                </div>

                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => {
                    setSearchOpen(false);
                    navigate(`/search?q=${query}`);
                  }}
                  className="w-full py-4 rounded-2xl bg-[#0f172a] text-white text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-black transition-all"
                >
                  Explore Archive
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}