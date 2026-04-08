import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import { motion, AnimatePresence } from "framer-motion";
import useAutoLogout from "../hooks/useAutoLogout";

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Track inactivity (10 minutes defaults in hook)
  useAutoLogout();

  return (
    <div className="min-h-screen bg-[#f8fafc] text-gray-900 font-sans flex overflow-hidden lg:overflow-visible">
      
      {/* Desktop Sidebar (Fixed) */}
      <div className="hidden lg:block fixed top-0 left-0 h-screen w-64 z-30 border-r border-[#e2e8f0] bg-white">
        <Sidebar />
      </div>

      {/* Mobile Drawer & Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[60] lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-[70] w-72 lg:hidden bg-white shadow-2xl border-r border-[#e2e8f0]"
            >
              <Sidebar onNavigate={() => setSidebarOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen w-full relative">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}