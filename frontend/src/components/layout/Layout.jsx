import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import BottomNav from "./BottomNav";
import MobileHeader from "./MobileHeader";
import Footer from "./Footer";
import { Toaster } from "react-hot-toast";
import WhatsAppButton from "../ui/WhatsAppButton";
import { AnimatePresence, motion } from "framer-motion";
import { slideInRight } from "../../utils/motion";

export default function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#111111] overflow-x-hidden">

      {/* 🏙️ Minimal Shell */}
      <div className="fixed inset-0 -z-10 bg-white" />

      {/* Header */}
      <Navbar />
      <MobileHeader />

      {/* Main Container */}
      <main className="flex-1 w-full max-w-[1400px] mx-auto px-6 md:px-10 py-8 md:py-8 lg:py-24 pb-32 md:pb-16 mt-0">

        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            variants={slideInRight}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>

      </main>

      {/* Footer + Mobile Nav */}
      <BottomNav />
      <Footer />

      {/* WhatsApp Support Button */}
      <WhatsAppButton />

      {/* Luxury Toast Experience */}
      <Toaster
        position="top-center"
        toastOptions={{
          className:
            "rounded-2xl bg-white text-[#0f172a] border border-[#E5E5E5] shadow-luxury px-6 py-4 text-[13px] font-bold uppercase tracking-widest",
        }}
      />
    </div>
  );
}