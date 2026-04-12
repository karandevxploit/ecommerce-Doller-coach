import { Heart, ArrowRight, Trash2, Sparkles, ShoppingBag, ShieldCheck, Zap } from "lucide-react";
import Button from "../components/ui/Button";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuthStore, useWishlistStore } from "../store";
import ProductCard from "../components/ProductCard";
import { motion, AnimatePresence } from "framer-motion";

export default function Wishlist() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { items, isLoading, toggleWishlist, fetchWishlist } = useWishlistStore();

  useEffect(() => {
    if (isAuthenticated) {
      fetchWishlist();
    }
  }, [isAuthenticated, fetchWishlist]);

  const products = items;
  const loading = isLoading;

  if (!isAuthenticated) {
    return (
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }}
        className="min-h-screen flex items-center justify-center px-6 bg-white pt-4"
      >
        <div className="max-w-[400px] w-full bg-[#f1f5f9] border border-[#F2F2F2] rounded-xl p-8 text-center shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 left-0 h-full w-1 bg-[#1e3a8a] opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <div className="h-12 w-12 bg-[#1e3a8a] text-[#0f172a] rounded-lg flex items-center justify-center mx-auto mb-6 shadow-sm">
            <Heart size={24} strokeWidth={3} fill="currentColor" />
          </div>

          <h2 className="text-2xl font-black text-[#0f172a] tracking-tighter mb-2 uppercase">
            Access Locked
          </h2>

          <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest mb-8 leading-relaxed">
            Iduser authentication required to sync your curation list.
          </p>

          <Button
            variant="primary"
            onClick={() => navigate("/login")}
            className="w-full uppercase tracking-widest text-xs"
          >
            Authorize Entry <ArrowRight size={16} strokeWidth={3} />
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }}
      className="min-h-screen bg-white pt-4 pb-32"
    >
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 space-y-10">

        {/* HEADER ARCHITECTURE */}
        <div className="flex justify-between items-end border-b border-[#F2F2F2] pb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
               <Heart size={14} className="text-[#1e3a8a]" strokeWidth={3} />
               <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest italic">
                 Private History
               </p>
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-[#0f172a] uppercase leading-none flex items-center gap-3">
              Wishlist <span className="text-base md:text-lg font-black text-[#1e3a8a]">[{products.length}]</span>
            </h1>
          </div>

          <Link
            to="/collection"
            className="border border-indigo-600 text-indigo-600 px-5 py-2.5 rounded-xl hover:bg-indigo-600 hover:text-white transition flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            Extend <ArrowRight size={14} strokeWidth={3} />
          </Link>
        </div>

        {/* EXECUTION SPACE */}
        {loading ? (
          <div className="flex justify-center py-40">
            <div className="h-10 w-10 border-2 border-gray-100 border-t-[#1e3a8a] animate-spin rounded-full" />
          </div>
        ) : products.length === 0 ? (
          <div className="py-24 text-center bg-[#f1f5f9] rounded-xl border border-dashed border-gray-200">
            <p className="text-xs font-black uppercase tracking-widest text-gray-300">
              No results found. No products localized in history.
            </p>
            <Button 
              variant="primary"
              onClick={() => navigate("/collection")}
              className="mt-8 text-xs uppercase tracking-widest"
            >
              INITIATE CURATION
            </Button>
          </div>

        ) : (

          /* MANIFEST GRID */
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {products.map((p, index) => (
              <motion.div 
                layout
                key={p.id ? `wish-${p.id}` : `wish-idx-${index}`} 
                className="relative group transition-all"
              >
                <ProductCard product={p} />
                <Button
                  variant="icon"
                  onClick={() => toggleWishlist(p.id)}
                  className="absolute top-2 right-2 bg-white/95 backdrop-blur-md z-30 border border-gray-100 shadow-lg text-red-500 hover:text-red-600 transition-all active:scale-90"
                >
                  <Trash2 size={14} />
                </Button>
              </motion.div>
            ))}
          </div>

        )}

        {/* LOGIC FOOTER */}
        <div className="pt-8 flex flex-col sm:flex-row justify-center items-center gap-5 border-t border-[#F2F2F2]">
            <div className="flex items-center gap-2">
               <div className="h-1.5 w-1.5 rounded-full bg-[#1e3a8a]" />
               <span className="text-[8px] font-black text-gray-300 uppercase tracking-widest">Secure Curation</span>
            </div>
            <div className="flex items-center gap-2">
               <ShieldCheck size={14} className="text-[#0f172a]" />
               <span className="text-[8px] font-black text-gray-300 uppercase tracking-widest">Iduser Verified</span>
            </div>
            <div className="flex items-center gap-2">
               <Zap size={14} className="text-[#1e3a8a]" />
               <span className="text-[8px] font-black text-gray-300 uppercase tracking-widest">High Priority Save</span>
            </div>
        </div>
      </div>
    </motion.div>
  );
}