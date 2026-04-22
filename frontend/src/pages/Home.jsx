import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { mapProduct } from "../api/dynamicMapper";
import ProductCard from "../components/ProductCard";
import SEO from "../components/SEO";
import {
  ProductCardSkeleton,
  HeroSkeleton,
} from "../components/ui/Skeleton";
import toast from "react-hot-toast";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import LuxuryHero from "../components/home/LuxuryHero";
import CategoryStrip from "../components/home/CategoryStrip";
import SectionWrapper from "../components/layout/SectionWrapper";
import { useSiteContentStore } from "../store/siteContentStore";
import { resolveImageUrl } from "../utils/url";

export default function Home() {
  const {
    content,
    previewContent,
    isPreviewMode,
    fetchContent,
  } = useSiteContentStore();

  const [products, setProducts] = useState([]);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentOffer, setCurrentOffer] = useState(0);

  // Auto Slide for Offers Carousel
  useEffect(() => {
    if (offers.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentOffer((prev) => (prev + 1) % offers.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [offers.length]);

  const activeContent = isPreviewMode
    ? previewContent
    : content;

  /* ---------------- FETCH ---------------- */
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);

        await fetchContent();

        // Parallel fetch for speed
        const [prodRes, offerRes] = await Promise.all([
          api.get("/products?page=1&limit=40"),
          api.get("/offers")
        ]);

        if (!mounted) return;

        // Products
        const rawProd = prodRes?.data || prodRes || {};
        const mappedProd = (rawProd.data || []).map(mapProduct);
        setProducts(mappedProd);

        // Offers
        const rawOffer = offerRes?.data || offerRes || {};
        setOffers(rawOffer.data || []);

      } catch (err) {
        toast.error("Failed to load storefront data");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  /* ---------------- SECTIONS ---------------- */
  const sections = useMemo(() => {
    if (!products.length) {
      return {
        best: [],
        trending: [],
        newArrivals: [],
      };
    }

    return {
      best: products
        .filter((p) =>
          p.badge?.text?.toLowerCase().includes("best")
        )
        .slice(0, 4),

      hotSell: products
        .filter((p) => p.isHot)
        .sort((a, b) => {
          const discA = a.discount || 0;
          const discB = b.discount || 0;
          if (discB !== discA) return discB - discA;
          return (b.salesCount || 0) - (a.salesCount || 0);
        })
        .slice(0, 4),

      trending: products.slice(0, 4),

      newArrivals: products
        .filter((p) => p.isNew || p.badge?.type === "new")
        .slice(0, 4),
    };
  }, [products]);

  /* ---------------- LOADING STATE ---------------- */
  if (loading) {
    return (
      <div className="bg-white min-h-screen">
        <HeroSkeleton />
        <div className="container-responsive py-16 space-y-20">
          <div className="space-y-8">
            <div className="h-8 w-48 bg-slate-100 rounded animate-pulse" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
              {Array.from({ length: 4 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- UI ---------------- */
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="bg-white min-h-screen"
    >
      <SEO
        title="Doller Coach | Premium Fashion"
        description="Premium everyday fashion and exclusive new arrivals."
      />

      {/* HERO */}
      <LuxuryHero slides={activeContent?.heroCarousel || []} />

      {/* CATEGORIES */}
      <CategoryStrip
        categories={[
          { name: "Men", path: "/collection/men" },
          { name: "Women", path: "/collection/women" },
          { name: "New Arrivals", path: "/collection/new-arrivals" },
          { name: "Best Sellers", path: "/collection/best-sellers" },
        ]}
      />

      <div className="py-12 space-y-16">
        {(() => {
          const showTrendingFirst = !sections.best || sections.best.length === 0;

          const bestSellersNode = sections.best?.length > 0 ? (
            <SectionWrapper
              title="Best Sellers"
              subtitle="Most popular products"
              viewAllPath="/collection/best-sellers"
            >
              <ProductGridFallback products={sections.best} />
            </SectionWrapper>
          ) : null;

          const hotSellNode = sections.hotSell?.length > 0 ? (
            <SectionWrapper
              title="HOT SELL 🔥"
              subtitle="Grab these before they're gone"
              viewAllPath="/collection/trending"
              className="bg-red-50/30 py-12 rounded-[3rem]"
            >
              <ProductGridFallback products={sections.hotSell} />
            </SectionWrapper>
          ) : null;

          const trendingNode = sections.trending?.length > 0 ? (
            <SectionWrapper
              title={showTrendingFirst ? "Trending Now" : "Trending"}
              subtitle={showTrendingFirst ? "Most popular right now" : "What’s popular right now"}
              viewAllPath="/collection/trending"
            >
              <ProductGridFallback products={sections.trending} />
            </SectionWrapper>
          ) : null;



          const promoBannerNode = offers.length > 0 ? (
            <section className="py-16">
              <div className="container-responsive">
                <div className="relative rounded-[2.5rem] overflow-hidden shadow-2xl group min-h-[500px] bg-slate-900">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentOffer}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className="absolute inset-0 flex items-center"
                    >
                      <img
                        src={resolveImageUrl(offers[currentOffer].image) || "https://images.unsplash.com/photo-1441995423663-f5ca21bc7af.jpg?q=80&w=2070"}
                        alt={offers[currentOffer].title}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/30 to-transparent" />

                      <div className="relative z-10 px-6 py-10 md:p-20 flex flex-col items-start text-white max-w-[95%] md:max-w-2xl">
                        {/* High-Contrast Safe Container */}
                        <div className="bg-black/40 backdrop-blur-xl p-8 md:p-12 rounded-[2.5rem] border border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] space-y-6">
                          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/70 border-b border-white/10 pb-1 inline-block mb-2 drop-shadow-sm">
                            Limited Time Offer
                          </p>

                          <div className="flex items-baseline gap-4">
                            <h2 className="text-6xl md:text-8xl font-black uppercase tracking-tighter leading-none italic text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                              {offers[currentOffer].discountValue}
                              <span className="text-3xl md:text-5xl not-italic ml-2 text-white/80">
                                {offers[currentOffer].discountType === 'percentage' ? '% OFF' : ' OFF'}
                              </span>
                            </h2>
                          </div>

                          <div className="space-y-4">
                            <h3 className="text-2xl md:text-4xl font-extrabold uppercase tracking-tight leading-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
                              {offers[currentOffer].title}
                            </h3>

                            <p className="text-sm md:text-lg text-gray-200 font-medium max-w-lg leading-relaxed drop-shadow-md">
                              {offers[currentOffer].description || "Exclusive collection deal available now."}
                            </p>
                          </div>

                          <div className="flex items-center gap-6 pt-4">
                            <Link
                              to={offers[currentOffer].link || "/collection"}
                              className="group/btn relative px-10 py-5 bg-white text-black font-black text-[10px] tracking-[0.2em] uppercase transition-all overflow-hidden rounded-xl shadow-xl hover:shadow-white/20"
                            >
                              <span className="relative z-10">Shop Now</span>
                              <div className="absolute inset-0 bg-slate-100 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300" />
                            </Link>

                            {offers[currentOffer].couponCode && (
                              <div className="hidden md:flex flex-col">
                                <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold mb-1">Use Code</span>
                                <span className="text-sm font-mono font-bold text-white border-b border-dashed border-white/30">{offers[currentOffer].couponCode}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </AnimatePresence>

                  {/* Navigation Arrows */}
                  {offers.length > 1 && (
                    <div className="absolute bottom-10 right-10 z-20 flex gap-3">
                      <button
                        onClick={() => setCurrentOffer((prev) => (prev - 1 + offers.length) % offers.length)}
                        className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center text-white hover:bg-white hover:text-black transition-all backdrop-blur-md"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <button
                        onClick={() => setCurrentOffer((prev) => (prev + 1) % offers.length)}
                        className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-black hover:bg-slate-200 transition-all shadow-xl"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>
                  )}

                  {/* Dots Indicator */}
                  {offers.length > 1 && (
                    <div className="absolute bottom-12 left-10 md:left-20 z-20 flex gap-2">
                      {offers.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentOffer(i)}
                          className={`h-1.5 transition-all duration-500 rounded-full ${i === currentOffer ? "w-8 bg-white" : "w-2 bg-white/30"
                            }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          ) : null;

          return showTrendingFirst ? (
            <>
              {hotSellNode}
              {trendingNode}
              {promoBannerNode}
              {bestSellersNode}
            </>
          ) : (
            <>
              {hotSellNode}
              {bestSellersNode}
              {promoBannerNode}
              {trendingNode}
            </>
          );
        })()}

        {/* NEW ARRIVALS */}
        <SectionWrapper
          title="New Arrivals"
          subtitle="Latest products delivered"
          viewAllPath="/collection/new-arrivals"
        >
          <ProductGridFallback products={sections.newArrivals} />
        </SectionWrapper>

      </div>
    </motion.div>
  );
}

/* ---------------- FALLBACK GRID ---------------- */
function ProductGridFallback({ products }) {
  if (!products || !products.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-6 bg-slate-50 border border-slate-100 rounded-lg mx-4 md:mx-0">
        <p className="text-sm font-medium uppercase tracking-widest text-slate-500">
          No products available right now
        </p>
        <Link
          to="/collection"
          className="px-6 py-3 bg-black text-white text-xs font-bold uppercase tracking-widest transition hover:bg-slate-800"
        >
          Browse Collection
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 px-4 md:px-0 auto-rows-fr">
      {products.map((p, i) => (
        <ProductCard key={p.id || p._id?.toString() || i} product={p} />
      ))}
    </div>
  );
}