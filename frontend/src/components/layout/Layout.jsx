import { Outlet, useLocation } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Navbar from "./Navbar";
import MobileHeader from "./MobileHeader";
import Footer from "./Footer";
import BottomNav from "./BottomNav";
import WhatsAppButton from "../ui/WhatsAppButton";
import CartDrawer from "../cart/CartDrawer";
import AuthModal from "../auth/AuthModal";

export default function Layout() {
  const location = useLocation();
  const [isCartOpen, setIsCartOpen] = useState(false);

  const openCart = useCallback(() => {
    setIsCartOpen(true);
  }, []);

  const closeCart = useCallback(() => {
    setIsCartOpen(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.pathname]);

  return (
    <div className="relative flex flex-col bg-slate-50 text-slate-900 min-h-screen w-full">
      <div className="hidden lg:block">
        <Navbar onCartClick={openCart} />
      </div>

      <div className="lg:hidden">
        <MobileHeader onCartClick={openCart} />
      </div>

      <main className="flex-1 w-full lg:pt-[68px] pt-0 pb-16 lg:pb-0" role="main">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${location.pathname}${location.search}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      <Footer />

      <div className="lg:hidden">
        <BottomNav onCartClick={openCart} />
      </div>

      <CartDrawer isOpen={isCartOpen} onClose={closeCart} />
      <AuthModal />
      <WhatsAppButton />
    </div>
  );
}
