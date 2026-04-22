import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Navbar from "./Navbar";
import MobileHeader from "./MobileHeader";
import OfferStrip from "./OfferStrip";
import Footer from "./Footer";
import BottomNav from "./BottomNav";
import { Toaster } from "react-hot-toast";
import WhatsAppButton from "../ui/WhatsAppButton";
import CartDrawer from "../cart/CartDrawer";
import AuthModal from "../auth/AuthModal";

export default function Layout() {
  const location = useLocation();
  const [isCartOpen, setIsCartOpen] = useState(false);

  const openCart = () => setIsCartOpen(true);
  const closeCart = () => setIsCartOpen(false);

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900 overflow-x-hidden">

      {/* Announcement */}
      <OfferStrip />

      {/* Desktop Header */}
      <div className="hidden lg:block">
        <Navbar onCartClick={openCart} />
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden">
        <MobileHeader onCartClick={openCart} />
      </div>

      {/* Main Content */}
      <main
        className="flex-1 w-full mx-auto pt-[60px] lg:pt-[72px] pb-16"
        role="main"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <Footer />

      {/* Bottom Navigation (Mobile Only) */}
      <div className="lg:hidden">
        <BottomNav onCartClick={openCart} />
      </div>

      {/* Global Components */}
      <CartDrawer isOpen={isCartOpen} onClose={closeCart} />
      <AuthModal />
      <WhatsAppButton />

      {/* Toasts */}
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          className:
            "rounded-xl bg-white text-slate-900 border border-slate-200 shadow-md px-4 py-3 text-xs font-semibold"
        }}
      />
    </div>
  );
}