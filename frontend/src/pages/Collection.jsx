import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import { ProductCardSkeleton } from "../components/ui/Skeleton";
import { ChevronDown, Check, X, Search, Sparkles } from "lucide-react";
import { api } from "../api/client";
import { mapProduct } from "../api/dynamicMapper";
import { motion, AnimatePresence } from "framer-motion";
import { staggerContainer, slideUp, modalTransition, springTransition, scaleIn } from "../utils/motion";

const CATEGORIES = ["All", "MEN", "WOMEN"];
const TYPES = ["All", "TOPWEAR", "BOTTOMWEAR", "FULL_OUTFIT"];
const SIZE_MAP = {
  TOPWEAR: ["S", "M", "L", "XL", "XXL"],
  BOTTOMWEAR: ["28", "30", "32", "34", "36", "38"],
  All: ["S", "M", "L", "XL", "28", "30", "32", "34", "36"] // Mixed fallback
};

const TOP_SIZES = ["S", "M", "L", "XL", "XXL"];
const BOTTOM_SIZES = ["28", "30", "32", "34", "36", "38"];

const SORT_OPTIONS = [
  { label: "Recommended", value: "recommended" },
  { label: "Newest", value: "newest" },
  { label: "Price Low", value: "price-asc" },
  { label: "Price High", value: "price-desc" },
];

export default function Collection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const category = searchParams.get("category") || "All";
  const type = searchParams.get("type") || "All";
  const sort = searchParams.get("sort") || "recommended";
  const [meta, setMeta] = useState({ page: 1, hasNextPage: false });
  const [fetchingMore, setFetchingMore] = useState(false);

  // Core loading effect
  useEffect(() => {
    const loadProducts = async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams(searchParams);
        if (query.get("category") === "All") query.delete("category");
        if (query.get("type") === "All") query.delete("type");
        query.set("page", "1");
        query.set("limit", "48");

        const res = await api.get(`/products?${query.toString()}`);
        const data = res?.data || res || {};
        const list = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);
        
        setProducts(list.map(mapProduct));
        setMeta({
          page: 1,
          hasNextPage: data.meta?.hasNextPage || false
        });
      } catch {
        console.error("Collection Load Error:", err);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, [searchParams]);

  // Load more logic
  const loadMore = async () => {
    if (fetchingMore || !meta.hasNextPage) return;
    setFetchingMore(true);
    try {
      const nextPage = meta.page + 1;
      const query = new URLSearchParams(searchParams);
      if (query.get("category") === "All") query.delete("category");
      if (query.get("type") === "All") query.delete("type");
      query.set("page", nextPage.toString());
      query.set("limit", "48");

      const res = await api.get(`/products?${query.toString()}`);
      const data = res?.data || res || {};
      const list = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);
      
      setProducts(prev => [...prev, ...list.map(mapProduct)]);
      setMeta({
        page: nextPage,
        hasNextPage: data.meta?.hasNextPage || false
      });
    } catch {
      console.error("Load More error:", err);
    } finally {
      setFetchingMore(false);
    }
  };

  const updateFilter = (key, value) => {
    const params = new URLSearchParams(searchParams);
    if (value === "All") {
      params.delete(key);
    } else {
      params.set(key, String(value));
    }
    setSearchParams(params);
  };

  const clearFilters = () => setSearchParams({});

  // Helper for size filtering logic
  const toggleSizeFilter = (key, size) => {
    const current = searchParams.get(key)?.split(",") || [];
    const isSelected = current.includes(size);
    const updated = isSelected 
      ? current.filter(x => x !== size)
      : [...current, size];
    updateFilter(key, updated.length ? updated.join(",") : "All");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* HEADER */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 leading-tight">Collections</h1>
        <p className="text-sm text-gray-500 mt-1">Discover our full range of premium apparel and accessories.</p>
      </div>

      {/* FILTER BAR */}
      <div className="flex flex-wrap items-center justify-between gap-4 py-4 border-b border-gray-100">
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => updateFilter("category", c)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                category === c
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="relative group">
          <motion.button 
            whileTap={{ scale: 0.95 }}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2 transition-colors">
            Sort: {SORT_OPTIONS.find((o) => o.value === sort)?.label}
            <ChevronDown size={14} className="group-hover:rotate-180 transition-transform duration-300" />
          </motion.button>
          
          <AnimatePresence>
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden"
            >
              {SORT_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => updateFilter("sort", o.value)}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 flex items-center justify-between transition-colors"
                >
                  {o.label}
                  {sort === o.value && <Check size={14} className="text-indigo-600" />}
                </button>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="flex gap-10 mt-8 h-[calc(100vh-320px)] min-h-[400px]">
        {/* SIDEBAR */}
        <aside className="w-56 hidden lg:block space-y-10 overflow-y-auto pr-6 no-scrollbar h-full">
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] leading-none mb-6">Categories</h3>
            <div className="flex flex-col gap-3">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => updateFilter("category", c)}
                  className={`text-left text-sm font-bold transition-all ${
                    category === c ? "text-[#0f172a] translate-x-1" : "text-gray-400 hover:text-black"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4 pt-6 border-t border-gray-100">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] leading-none mb-6">Product Type</h3>
            <div className="flex flex-col gap-3">
              {TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => updateFilter("type", t)}
                  className={`text-left text-sm font-bold transition-all ${
                    type === t ? "text-[#0f172a] translate-x-1" : "text-gray-400 hover:text-black"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* SIZES - DYNAMIC BASED ON TYPE */}
          <div className="space-y-6 pt-6 border-t border-gray-100">
            {type === "FULL_OUTFIT" ? (
              <div className="space-y-8">
                <div>
                  <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] leading-none mb-4">Top Sizes</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {TOP_SIZES.map((s) => {
                      const isSelected = searchParams.get("topSizes")?.split(",").includes(s);
                      return (
                        <button
                          key={s}
                          onClick={() => toggleSizeFilter("topSizes", s)}
                          className={`h-10 flex items-center justify-center rounded-lg border text-[10px] font-black transition-all ${
                            isSelected 
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100" 
                              : "bg-white text-gray-400 border-gray-100 hover:border-gray-300"
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] leading-none mb-4">Bottom Sizes</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {BOTTOM_SIZES.map((s) => {
                      const isSelected = searchParams.get("bottomSizes")?.split(",").includes(s);
                      return (
                        <button
                          key={s}
                          onClick={() => toggleSizeFilter("bottomSizes", s)}
                          className={`h-10 flex items-center justify-center rounded-lg border text-[10px] font-black transition-all ${
                            isSelected 
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100" 
                              : "bg-white text-gray-400 border-gray-100 hover:border-gray-300"
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] leading-none mb-6">Sizes</h3>
                <div className="grid grid-cols-3 gap-2">
                  {(SIZE_MAP[type] || SIZE_MAP.All).map((s) => {
                    const isSelected = searchParams.get("sizes")?.split(",").includes(s);
                    return (
                      <button
                        key={s}
                        onClick={() => toggleSizeFilter("sizes", s)}
                        className={`h-10 flex items-center justify-center rounded-lg border text-[10px] font-black transition-all ${
                          isSelected 
                            ? "bg-[#0f172a] text-white border-[#0f172a]" 
                            : "bg-white text-gray-400 border-gray-100 hover:border-gray-300"
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-gray-100">
            <button
              onClick={clearFilters}
              className="text-[10px] font-black text-gray-400 hover:text-red-500 transition-colors flex items-center gap-2 uppercase tracking-widest"
            >
              <X size={14} /> Clear Manifest
            </button>
          </div>
        </aside>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar h-full">
          <motion.div 
            variants={staggerContainer(0.08)}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
          >
            {loading
              ? [...Array(8)].map((_, i) => (
                  <motion.div key={`skel-${i}`} variants={slideUp}>
                    <ProductCardSkeleton />
                  </motion.div>
                ))
              : Array.isArray(products) ? products.map((p) => (
                  <motion.div key={p?._id || p?.id} variants={slideUp}>
                    <ProductCard product={p} />
                  </motion.div>
                )) : null}
          </motion.div>

          {meta.hasNextPage && (
            <div className="mt-16 flex justify-center pb-12">
              <button
                disabled={fetchingMore}
                onClick={loadMore}
                className="px-12 py-4 bg-[#0f172a] text-white rounded-xl text-xs font-black uppercase tracking-[0.3em] hover:scale-[1.03] active:scale-95 shadow-2xl transition-all disabled:opacity-50 flex items-center gap-3"
              >
                {fetchingMore ? (
                   <span className="h-4 w-4 border-2 border-white/30 border-t-white animate-spin rounded-full" />
                ) : (
                   <Sparkles size={16} className="text-[#1e3a8a]" strokeWidth={3} />
                )}
                {fetchingMore ? "Synchronizing..." : "Explore more"}
              </button>
            </div>
          )}
          <div className="mt-12" />
        </div>
      </div>
    </div>
  );
}