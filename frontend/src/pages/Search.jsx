import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { mapProduct } from "../api/dynamicMapper";
import ProductCard from "../components/ProductCard";
import toast from "react-hot-toast";
import { Sparkles, Search as SearchIcon, ArrowRight, ShoppingBag, Zap, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Search() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const q = params.get("q") || "";
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        if (!q.trim()) {
          setProducts([]);
          return;
        }
        const res = await api.get(`/products?q=${encodeURIComponent(q)}`);
        const data = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : Array.isArray(res?.items) ? res.items : [];
        if (!cancelled) {
          setProducts(Array.isArray(data) ? data.map(mapProduct) : []);
        }
      } catch (err) {
        toast.error("Error loading: Search Database");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [q]);

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }}
      className="min-h-screen bg-white pt-4 pb-32"
    >
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 space-y-10">

        {/* INQUIRY HEADER */}
        <div className="flex justify-between items-end border-b border-[#F2F2F2] pb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
               <SearchIcon size={14} className="text-[#1e3a8a]" strokeWidth={3} />
               <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest italic">
                 Search Index
               </p>
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-[#0f172a] uppercase leading-none flex items-center gap-3">
              Results <span className="text-base md:text-lg font-black text-[#1e3a8a]">[{products.length}]</span>
            </h1>
            <div className="flex items-center gap-3 pt-1">
               <span className="px-4 py-2 text-sm rounded-lg bg-[#0f172a] text-white hover:scale-[1.02] shadow-sm transition-all">"{q}"</span>
            </div>
          </div>

          <button
            onClick={() => navigate("/collection")}
            className="h-10 px-6 bg-[#1e3a8a] text-[#0f172a] rounded-lg text-[10px] font-black uppercase tracking-widest hover:shadow-md transition-all flex items-center gap-3 shadow-sm"
          >
            History <ArrowRight size={14} strokeWidth={3} />
          </button>
        </div>

        {/* RESULTS EXECUTION */}
        {loading ? (
          <div className="flex justify-center py-40">
            <div className="h-10 w-10 border-2 border-gray-100 border-t-[#1e3a8a] animate-spin rounded-full" />
          </div>
        ) : products.length === 0 ? (
          <div className="py-24 text-center bg-[#f1f5f9] rounded-xl border border-dashed border-gray-200">
            <p className="text-xs font-black uppercase tracking-widest text-gray-300">
              No results for this inquiry.
            </p>
            <button 
              onClick={() => navigate("/collection")}
              className="mt-8 h-10 px-8 bg-[#0f172a] text-[#1e3a8a] rounded-lg text-xs font-black uppercase tracking-widest shadow-sm active:scale-95"
            >
              Reset Order
            </button>
          </div>

        ) : (
          
          /* MANIFEST GRID */
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

        )}
        
        {/* LOGIC FOOTER */}
        <div className="pt-8 flex flex-col sm:flex-row justify-center items-center gap-5 border-t border-[#F2F2F2]">
            <div className="flex items-center gap-2">
               <div className="h-1.5 w-1.5 rounded-full bg-[#1e3a8a]" />
               <span className="text-[8px] font-black text-gray-300 uppercase tracking-widest">Rapid Indexing</span>
            </div>
            <div className="flex items-center gap-2">
               <ShieldCheck size={14} className="text-[#0f172a]" />
               <span className="text-[8px] font-black text-gray-300 uppercase tracking-widest">Global List</span>
            </div>
            <div className="flex items-center gap-2">
               <ShoppingBag size={14} className="text-[#1e3a8a]" />
               <span className="text-[8px] font-black text-gray-300 uppercase tracking-widest">Inventory Save</span>
            </div>
        </div>
      </div>
    </motion.div>
  );
}