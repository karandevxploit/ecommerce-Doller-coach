import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCartStore, useAuthStore } from "../store";
import { api } from "../api/client";
import { mapProduct } from "../api/dynamicMapper";
import {
  Trash2,
  ArrowRight,
  ShoppingBag,
  ShieldCheck,
  Truck,
  Sparkles,
  Minus,
  Plus,
  Zap
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatPrice } from "../utils/format";
import Button from "../components/ui/Button";

export default function Cart() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { items, updateQuantity, removeItem, getCartTotal, fetchCart, isLoading } = useCartStore();
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    if (isAuthenticated) fetchCart();
  }, [isAuthenticated, fetchCart]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (items.length === 0) return;
      try {
        const res = await api.get(`/products?category=${items[0].category}`);
        const data = Array.isArray(res) ? res : res?.data || res?.products || [];
        const mapped = Array.isArray(data) ? data.map(mapProduct) : [];
        setSuggestions(mapped.filter((p) => !items.some((i) => (i._id || i.id) === (p._id || p.id))).slice(0, 4));
      } catch {
        setSuggestions([]);
      }
    };
    fetchSuggestions();
  }, [items?.length > 0 ? items[0].category : null]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-8 bg-white overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-[#1e3a8a]" />
        <div className="w-20 h-20 rounded-xl bg-[#f1f5f9] flex items-center justify-center mb-8 border border-[#F2F2F2] shadow-sm transform">
           <ShieldCheck size={40} className="text-[#1e3a8a]" strokeWidth={1.5} />
        </div>
        <h2 className="text-3xl font-black text-[#0f172a] tracking-tighter uppercase mb-4 leading-none">Security Required</h2>
        <p className="text-gray-400 font-bold uppercase tracking-widest text-sm max-w-sm mb-8 leading-relaxed opacity-60">
          Authenticate your iduser node to access bags.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
          <Button variant="primary" onClick={() => navigate("/login")} className="flex-1 text-[11px] uppercase tracking-widest w-full">
            Initialize Access
          </Button>
          <Button variant="outline" onClick={() => navigate("/register")} className="flex-1 text-[11px] uppercase tracking-widest w-full">
            New User
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading && items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="h-14 w-14 border-4 border-gray-50 border-t-[#1e3a8a] animate-spin rounded-full shadow-lg" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-8 bg-white overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gray-100" />
        <div className="w-20 h-20 rounded-xl bg-[#f1f5f9] flex items-center justify-center mb-8 border border-[#F2F2F2] shadow-sm">
           <ShoppingBag size={40} className="text-gray-200" strokeWidth={1.5} />
        </div>
        <h2 className="text-3xl font-black text-[#0f172a] tracking-tighter uppercase mb-4 leading-none">Empty Product</h2>
        <p className="text-gray-400 font-bold uppercase tracking-widest text-sm max-w-sm mb-8 leading-relaxed opacity-60">
          Your threshold is zero.
        </p>
        <Button variant="primary" onClick={() => navigate("/collection")} className="text-sm">
          The Hub <ArrowRight size={16} strokeWidth={3} />
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen pt-4 pb-24">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10">
        
        {/* IDENTITY HEADER */}
        <div className="mb-10 flex justify-between items-end border-b border-[#F2F2F2] pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
               <Zap size={14} className="text-[#1e3a8a]" />
               <span className="text-[9px] font-black uppercase tracking-widest text-gray-300">Transaction</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-[#0f172a] uppercase leading-none">
              The Bag <span className="text-[#1e3a8a]">[{items.length}]</span>
            </h1>
          </div>
          
          <Button 
           variant="primary"
           onClick={() => navigate("/collection")}
          >
            History
          </Button>
        </div>

        <div className="grid lg:grid-cols-12 gap-20">
          {/* LEFT: MANIFEST LOGS */}
          <div className="lg:col-span-7 space-y-4">
            <AnimatePresence>
              {items.map((item) => (
                <motion.div
                  key={item.cartItemId}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group flex gap-3 bg-white border border-[#F2F2F2] rounded-xl p-3 transition-all hover:shadow-sm hover:border-[#1e3a8a]/30"
                >
                  {/* VISUAL COMPONENT */}
                  <Link to={`/product/${item.id}`} className="w-24 h-32 rounded-lg overflow-hidden bg-[#f1f5f9] border border-[#F2F2F2] flex-shrink-0">
                    {item.image ? (
                      <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-white text-[8px] text-gray-200 font-black">No Update</div>
                    )}
                  </Link>

                  {/* LOGIC INTERFACE */}
                  <div className="flex-1 flex flex-col justify-between py-1">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <Link to={`/product/${item.id}`} className="font-black text-base text-[#0f172a] tracking-tighter hover:text-[#1e3a8a] transition-colors uppercase leading-tight">
                          {item.title}
                        </Link>
                        <Button
                          variant="icon"
                          onClick={() => removeItem(item.id)}
                          className="h-8 w-8 !p-1 text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 size={16} strokeWidth={2.5} />
                        </Button>
                      </div>
                      <div className="flex gap-2">
                         <span className="px-4 py-2 text-sm rounded-lg bg-[#0f172a] text-white hover:scale-[1.02] shadow-sm transition-all">
                           {item.category}
                         </span>
                         {item.topSize && item.bottomSize ? (
                           <span className="px-4 py-2 text-sm rounded-lg bg-[#0f172a] text-white hover:scale-[1.02] shadow-sm transition-all">
                             Size: {item.topSize} (T) / {item.bottomSize} (B)
                           </span>
                         ) : item.size ? (
                           <span className="px-4 py-2 text-sm rounded-lg bg-[#0f172a] text-white hover:scale-[1.02] shadow-sm transition-all">
                             Size: {item.size}
                           </span>
                         ) : null}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-6">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="quantity"
                          onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                        >
                          <Minus size={12} strokeWidth={3} />
                        </Button>
                        <span className="w-8 text-center text-xs font-black text-[#0f172a]">{item.quantity}</span>
                        <Button
                          variant="quantity"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        >
                          <Plus size={12} strokeWidth={3} />
                        </Button>
                      </div>
                      
                      <div className="text-right">
                         <p className="text-base font-black text-[#0f172a] tracking-tighter">
                           {formatPrice(item.price * item.quantity)}
                         </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* SYNC SUGGESTIONS */}
            {suggestions.length > 0 && (
              <div className="mt-12 pt-10 border-t border-[#F2F2F2]">
                <h3 className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-6 px-2">Suggestions</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {suggestions.map((p) => (
                    <Link key={p.id} to={`/product/${p.id}`} className="group relative rounded-xl overflow-hidden bg-white border border-[#F2F2F2] block aspect-[3/4] shadow-sm">
                      <img src={p.image} className="w-full h-full object-cover grayscale-[0.4] group-hover:grayscale-0 transition-all duration-700" />
                      <div className="absolute inset-x-0 bottom-0 p-3 bg-white/90 backdrop-blur-sm border-t border-gray-100 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                        <p className="text-[8px] font-black text-[#0f172a] uppercase truncate">{p.title}</p>
                        <p className="text-[10px] font-black text-[#1e3a8a]">{formatPrice(p.price)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: ANALYTICS SUMMARY */}
          <div className="lg:col-span-5 relative">
            <div className="sticky top-24 bg-[#f1f5f9] border border-[#F2F2F2] rounded-2xl p-3 space-y-6 shadow-sm">
              <div className="space-y-4">
                 <h3 className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-4 border-b border-gray-100 pb-3 flex justify-between">
                    Summary <ShieldCheck size={14} className="text-[#1e3a8a]" />
                 </h3>

                 <div className="space-y-4">
                   <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-gray-400">
                     <span>Subtotal</span>
                     <span className="text-[#0f172a]">{formatPrice(getCartTotal())}</span>
                   </div>
                   <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-gray-400">
                     <span>Logistics</span>
                     <span className={getCartTotal() > 500 ? "text-[#1e3a8a]" : "text-[#0f172a]"}>
                       {getCartTotal() > 500 ? "FREE" : formatPrice(40)}
                     </span>
                   </div>
                   
                   <div className="pt-6 border-t border-[#F2F2F2] space-y-1">
                      <p className="text-[8px] font-black text-[#1e3a8a] uppercase tracking-widest">Total product</p>
                      <p className="text-3xl font-black text-[#0f172a] tracking-tighter leading-none">
                        {formatPrice(getCartTotal() > 500 ? getCartTotal() : getCartTotal() + 40)}
                      </p>
                   </div>
                 </div>
              </div>

              <div className="space-y-4">
                <Button
                  variant="primary"
                  onClick={() => navigate("/checkout")}
                  className="w-full text-xs uppercase tracking-widest"
                >
                  Checkout <ArrowRight size={18} strokeWidth={3} />
                </Button>
                
                <div className="grid grid-cols-2 gap-3">
                   <div className="bg-white border border-[#F2F2F2] p-3 rounded-xl flex flex-col items-center gap-1.5 text-center transition-all hover:border-[#1e3a8a] group shadow-sm">
                      <ShieldCheck size={14} className="text-gray-300 group-hover:text-[#1e3a8a]" />
                      <span className="text-[7px] font-black text-gray-300 group-hover:text-[#0f172a] uppercase tracking-widest">Secure</span>
                   </div>
                   <div className="bg-white border border-[#F2F2F2] p-3 rounded-xl flex flex-col items-center gap-1.5 text-center transition-all hover:border-[#1e3a8a] group shadow-sm">
                      <Truck size={14} className="text-gray-300 group-hover:text-[#1e3a8a]" />
                      <span className="text-[7px] font-black text-gray-300 group-hover:text-[#0f172a] uppercase tracking-widest">Save</span>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}