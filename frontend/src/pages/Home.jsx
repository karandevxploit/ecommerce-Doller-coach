import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api/client";
import { mapProduct, mapOffer } from "../api/dynamicMapper";
import ProductCard from "../components/ProductCard";
import SEO from "../components/SEO";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Sparkles, ArrowRight, ShieldCheck, Zap } from "lucide-react";
import { ProductCardSkeleton } from "../components/ui/Skeleton";
import toast from "react-hot-toast";
import CouponBox from "../components/ui/CouponBox";

export default function Home() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [p, o] = await Promise.all([
          api.get("/products?page=1&limit=48"),
          api.get("/offers"),
        ]);
        const productList = Array.isArray(p) ? p : p?.data || p?.products || p?.items || [];
        const offerList = Array.isArray(o) ? o : o?.data || [];

        const now = new Date();
        const activeOffers = offerList
          .map(mapOffer)
          .filter(off => off.isActive && new Date(off.endDate) > now);

        setProducts(productList.map(mapProduct));
        setOffers(activeOffers);
      } catch {
        toast.error("Error loading: Core Product System");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);
  useEffect(() => {
    const t = setInterval(() => setTick((p) => p + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (offers.length <= 1) return;
    const t = setInterval(() => setActive((p) => (p + 1) % offers.length), 7000);
    return () => clearInterval(t);
  }, [offers]);

  if (loading) {
    return (
      <div className="space-y-16 py-8 px-6 md:px-10 max-w-[1400px] mx-auto bg-white min-h-screen">
        <div className="h-[70vh] bg-[#f1f5f9] rounded-[3rem] " />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-5">
          {[...Array(5)].map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      className="space-y-24 bg-white"
    >
      <SEO
        title="DOLLER Coach | Minimalist Luxury"
        description="Experience the next standard of premium minimalist fashion. Engineered for tomorrow."
      />

      {/* HERO SECTION */}
      <section className="relative min-h-[60vh] md:h-[70vh] flex items-center bg-[#f1f5f9] overflow-hidden py-10 md:py-0">
        <div className="max-w-md md:max-w-[1400px] mx-auto px-4 md:px-10 flex flex-col md:flex-row items-center justify-between w-full h-full gap-8 md:gap-0">

          <div className="relative z-20 flex flex-col justify-center items-center md:items-start text-center md:text-left w-full md:w-[50%] h-full">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 mb-4"
            >
              <div className="w-8 h-[1px] bg-[#0f172a]/20" />
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#0f172a]/40">Seasonal Manifest</span>
                {offers[active]?.status && offers[active].status !== "ACTIVE" && (
                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                    offers[active].status === "COMING" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                  }`}>
                    {offers[active].status}
                  </span>
                )}
                {offers[active]?.status === "ACTIVE" && (
                  <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-green-100 text-green-700 flex items-center gap-1">
                    <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" /> LIVE NOW
                  </span>
                )}
              </div>
            </motion.div>

            <motion.h1
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-3xl md:text-7xl font-bold text-[#0f172a] mb-6 tracking-tighter leading-tight md:leading-[0.9]"
            >
              {offers[active]?.title || "Essentials For The Modern Era."}
            </motion.h1>

            <motion.p
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-gray-500 mb-2 max-w-md md:max-w-sm text-sm md:text-base font-medium leading-relaxed px-2 md:px-0"
            >
              {offers[active]?.description || "Curated minimalist luxury designed for daily precision."}
            </motion.p>

            {/* DYNAMIC COUPON MODULE */}
            {offers[active]?.couponCode && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
              >
                <CouponBox 
                  code={offers[active].couponCode} 
                  discountText={offers[active].discountValue ? `${offers[active].discountValue}${offers[active].discountType === 'percentage' ? '%' : '₹'} OFF` : ""}
                />
              </motion.div>
            )}

            {offers[active]?.status === "ACTIVE" && offers[active]?.endDate && (
              <div className="mb-6 px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl inline-flex items-center gap-3">
                <div className="flex flex-col">
                  <span className="text-[7px] font-black uppercase tracking-[0.2em] text-gray-400">Ends In</span>
                  <span className="text-xs font-black text-[#0f172a] tabular-nums">
                    {(() => {
                      const now = new Date();
                      const end = new Date(offers[active].endDate);
                      const diff = Math.max(0, end - now);
                      const h = Math.floor(diff / 3600000);
                      const m = Math.floor((diff % 3600000) / 60000);
                      const s = Math.floor((diff % 60000) / 1000);
                      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                    })()}
                  </span>
                </div>
              </div>
            )}

            <motion.button
              onClick={() => navigate("/collection")}
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="w-full md:w-auto px-10 py-4 md:py-3 text-[10px] rounded-2xl md:rounded-xl bg-[#0f172a] text-white hover:bg-black shadow-xl transition-all flex items-center justify-center gap-3 font-black uppercase tracking-widest group"
            >
              Explore Collection <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </motion.button>
          </div>

          <div className="relative w-full md:w-[45%] h-48 sm:h-64 md:h-[80%] flex items-center justify-center mt-4 md:mt-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.6, ease: "circOut" }}
                className="w-full h-full rounded-2xl overflow-hidden shadow-xl md:shadow-2xl border border-white/20"
              >
                {offers[active]?.image ? (
                  <img
                    src={offers[active].image}
                    loading="lazy"
                    className="w-full h-full object-cover grayscale-[0.2] hover:grayscale-0 transition-all duration-700"
                    alt="Highlight"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                    <Sparkles size={48} className="text-gray-300" />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* CATEGORY SEGMENTS - PREMIUM MINIMALIST GRID */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 px-4 md:px-8 max-w-[1400px] mx-auto">
        {[
          { 
            name: "MEN", 
            img: "/images/category-men.png",
            tag: "ESSENTIALS"
          },
          { 
            name: "WOMEN", 
            img: "/images/category-women.png",
            tag: "COLLECTION"
          }
        ].map((c, i) => (
          <motion.div
            key={c.name}
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            className="group relative h-[200px] sm:h-[240px] md:h-[280px] rounded-2xl overflow-hidden cursor-pointer shadow-md hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
          >
            <Link to={`/collection?category=${c.name}`} className="block h-full relative">
              {/* IMAGE LAYER */}
              <img
                src={c.img}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                alt={c.name}
              />
              
              {/* OVERLAY LAYERS */}
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-300" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

              {/* CONTENT LAYER */}
              <div className="absolute bottom-6 left-6 z-20 text-white">
                <p className="text-[10px] font-black opacity-70 tracking-[0.2em] uppercase mb-1">{c.tag}</p>
                <h2 className="text-3xl font-black tracking-tighter uppercase leading-none">
                  {c.name}
                </h2>
              </div>

              {/* INTERACTION ICON */}
              <div className="absolute top-6 right-6 z-20">
                <div className="h-10 w-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 -translate-y-4 group-hover:translate-y-0 transition-all duration-500">
                  <ArrowRight size={20} />
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </section>

      {/* CORE FEATURED LIST */}
      <section className="space-y-12 px-6 md:px-10 max-w-[1400px] mx-auto">
        <div className="flex justify-between items-end">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-[#0f172a]" />
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-300">Curated items</span>
            </div>
            <h2 className="text-3xl font-black tracking-tighter text-[#0f172a] uppercase leading-tight">
              Featured items
            </h2>
          </div>

          <button
            onClick={() => navigate("/collection")}
            className="px-4 py-2 text-sm rounded-lg bg-[#0f172a] text-white hover:scale-[1.02] shadow-sm transition-all"
          >
            Explore <ArrowRight size={14} strokeWidth={3} />
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* TRANSMISSION NODE */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="bg-[#f1f5f9] border border-[#F2F2F2] rounded-3xl p-10 md:p-16 text-center shadow-sm relative overflow-hidden mx-6 md:mx-10"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-[#0f172a]" />

        <h2 className="text-3xl md:text-5xl font-black mb-6 tracking-tighter text-[#0f172a] uppercase leading-none">
          The Inner Circle.
        </h2>

        <p className="text-gray-400 mb-8 max-w-sm mx-auto text-sm font-bold uppercase tracking-widest leading-relaxed">
          Join the list for exclusive invitations and new drops.
        </p>

        <form onSubmit={(e) => { e.preventDefault(); toast.success("Transmission Received."); }} className="flex flex-col sm:flex-row gap-3 justify-center max-w-lg mx-auto">
          <input
            type="email"
            required
            placeholder="ACCESS EMAIL"
            className="flex-1 px-6 py-4 text-[10px] font-black uppercase tracking-widest rounded-2xl bg-white border border-gray-100 text-[#0f172a] focus:ring-2 focus:ring-[#0f172a] outline-none transition-all placeholder:text-gray-200"
          />
          <button type="submit" className="px-8 py-4 text-[10px] font-black uppercase tracking-widest rounded-2xl bg-[#0f172a] text-white hover:bg-black transition-all shadow-lg">
            Authorize
          </button>
        </form>
      </motion.section>
    </motion.div>
  );
}