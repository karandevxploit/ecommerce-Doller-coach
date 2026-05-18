import { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { api, safeApi } from "../api/client";
import { mapProduct, mapOffer } from "../api/dynamicMapper";
import ProductCard from "../components/ProductCard";
import SEO from "../components/SEO";
import {
  ProductCardSkeleton,
  HeroSkeleton,
} from "../components/ui/Skeleton";
import toast from "react-hot-toast";
import { ChevronLeft, ChevronRight } from "lucide-react";
import LuxuryHero from "../components/home/LuxuryHero";
import CategoryStrip from "../components/home/CategoryStrip";
import SectionWrapper from "../components/layout/SectionWrapper";
import { useSiteContentStore } from "../store/siteContentStore";
import SafeImage from "../components/ui/SafeImage";
import { resolveVideoUrl } from "../utils/url";

const getResponseData = (response) => response?.data ?? response;

const getList = (response, key) => {
  const body = getResponseData(response);
  const data = body?.data ?? body;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[key])) return data[key];
  if (Array.isArray(data?.products)) return data.products;
  if (Array.isArray(data?.offers)) return data.offers;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;

  return [];
};

const getOfferList = (response) => {
  const body = response?.data ?? response;
  const payload = body?.data ?? body;

  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.offers)) return payload.offers;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(body?.offers)) return body.offers;
  if (Array.isArray(body?.items)) return body.items;

  return [];
};

const isCanceled = (error) => {
  return (
    error?.name === "CanceledError" ||
    error?.name === "AbortError" ||
    error?.code === "ERR_CANCELED" ||
    error?.message?.toLowerCase?.().includes("canceled")
  );
};

const toHotSaleProducts = (products) =>
  mapProductList(products)
    .map((product) => {
      const price = Number(product.price) || 0;
      const originalPrice = Number(product.originalPrice) || 0;
      const discount =
        originalPrice > price && originalPrice > 0
          ? Math.round(((originalPrice - price) / originalPrice) * 100)
          : 0;

      return { ...product, discount };
    })
    .filter((product) => product.price <= 50 || product.discount >= 50)
    .sort((a, b) => (b.discount - a.discount) || (a.price - b.price))
    .slice(0, 8);

const mapProductList = (list) =>
  Array.isArray(list) ? list.map(mapProduct).filter(Boolean) : [];

const OfferCountdown = ({ status, remainingTime }) => {
  const safeRemaining = Number(remainingTime);
  const [timeLeft, setTimeLeft] = useState(
    Number.isFinite(safeRemaining) ? Math.max(0, safeRemaining) : 0
  );

  useEffect(() => {
    const next = Number(remainingTime);
    const initial = Number.isFinite(next) ? Math.max(0, next) : 0;

    setTimeLeft(initial);

    if (initial <= 0) return undefined;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1000) {
          clearInterval(interval);
          return 0;
        }

        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [remainingTime]);

  if (timeLeft <= 0) return null;

  const hrs = Math.floor(timeLeft / (1000 * 60 * 60));
  const mins = Math.floor((timeLeft / (1000 * 60)) % 60);
  const secs = Math.floor((timeLeft / 1000) % 60);

  const prefix = status === "UPCOMING" ? "Starts in" : "Ends in";

  return (
    <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-white/90">
      <span className="text-[10px] uppercase tracking-widest font-black opacity-80">
        {prefix}
      </span>

      <span className="font-mono font-bold text-sm">
        {String(hrs).padStart(2, "0")}h {String(mins).padStart(2, "0")}m{" "}
        {String(secs).padStart(2, "0")}s
      </span>
    </div>
  );
};

export default function Home() {
  const { content, previewContent, isPreviewMode, fetchContent } =
    useSiteContentStore();

  const [newArrivals, setNewArrivals] = useState([]);
  const [hotSale, setHotSale] = useState([]);
  const [trending, setTrending] = useState([]);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentOffer, setCurrentOffer] = useState(0);

  const activeContent = isPreviewMode ? previewContent : content;

  const mapProducts = mapProductList;

  const mapOffers = (list) =>
    Array.isArray(list) ? list.map(mapOffer).filter(Boolean) : [];

  const fetchOffersOnly = useCallback(async (signal) => {
    const res = await api.get("/offers", {
      signal,
      params: { t: Date.now() },
      __skipAuthRefresh: true,
    });
    return mapOffers(getOfferList(res));
  }, []);

  const fetchHomeData = useCallback(async (signal) => {
    try {
      setLoading(true);

      const [offerRes, hotRes, trendRes, newRes] = await Promise.allSettled([
        api.get("/offers", {
          signal,
          params: { t: Date.now() },
          __skipAuthRefresh: true,
        }),
        safeApi.get("/products/hot-sale", { signal }),
        safeApi.get("/products/trending", { signal }),
        safeApi.get("/products/new-arrivals", { signal }),
      ]);

      if (signal?.aborted) return;

      const offerList =
        offerRes.status === "fulfilled" ? getOfferList(offerRes.value) : [];
      const hotList =
        hotRes.status === "fulfilled" ? getList(hotRes.value, "products") : [];
      const trendList =
        trendRes.status === "fulfilled"
          ? getList(trendRes.value, "products")
          : [];
      const newList =
        newRes.status === "fulfilled" ? getList(newRes.value, "products") : [];

      setOffers(mapOffers(offerList));
      setHotSale(mapProducts(hotList));
      setTrending(mapProducts(trendList));
      setNewArrivals(mapProducts(newList));
    } catch (error) {
      if (!isCanceled(error)) {
        setOffers([]);
        setHotSale([]);
        setTrending([]);
        setNewArrivals([]);
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetchHomeData(controller.signal);

    Promise.resolve(fetchContent?.()).catch(() => {
      // Site content fallback is handled by UI defaults.
    });

    const offerInterval = setInterval(async () => {
      try {
        const freshOffers = await fetchOffersOnly(controller.signal);
        if (!controller.signal.aborted) {
          setOffers(freshOffers);
        }
      } catch (error) {
        if (!isCanceled(error)) {
          // Keep old offers instead of clearing UI.
        }
      }
    }, 30000);

    return () => {
      controller.abort();
      clearInterval(offerInterval);
    };
  }, [fetchHomeData, fetchContent, fetchOffersOnly]);

  useEffect(() => {
    if (currentOffer >= offers.length) {
      setCurrentOffer(0);
    }
  }, [currentOffer, offers.length]);

  useEffect(() => {
    if (offers.length <= 1) return undefined;

    const timer = setInterval(() => {
      setCurrentOffer((prev) => (prev + 1) % offers.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [offers.length]);

  const handleCopyCoupon = async (code) => {
    if (!code) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = code;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      toast.success("Coupon code copied!");
    } catch {
      toast.error("Unable to copy coupon");
    }
  };

  const sections = useMemo(
    () => {
      const uniqueProducts = (list) =>
        Array.from(
          new Map(
            (Array.isArray(list) ? list : [])
              .filter((product) => product && typeof product === "object")
              .map((product) => [
                String(product?._id || product?.id || product?.slug || product?.name || product?.title),
                product,
              ])
          ).values()
        );

      const byGender = (list, gender) =>
        uniqueProducts(list).filter((product) => {
          const productGender = String(product?.gender || product?.category?.gender || "").toLowerCase();
          return productGender === gender;
        });

      return {
        hotSell: uniqueProducts(hotSale),
        trending: uniqueProducts(trending),
        newArrivals: uniqueProducts(newArrivals),
        men: byGender([...hotSale, ...trending, ...newArrivals], "men"),
        women: byGender([...hotSale, ...trending, ...newArrivals], "women"),
      };
    },
    [hotSale, newArrivals, trending]
  );

  /* ---------------- LOADING STATE ---------------- */
  if (loading) {
    return (
      <div className="bg-white min-h-screen">
        <HeroSkeleton />

        <div className="container-responsive py-16 space-y-20">
          <div className="space-y-8">
            <div className="h-8 w-48 bg-slate-100 rounded animate-pulse" />

            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <ProductCardSkeleton key={`home-product-skeleton-${index}`} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const safeOffers = Array.isArray(offers) ? offers : [];
  const fallbackOffer = {
    id: "store-promo-fallback",
    title:
      activeContent?.banners?.promoBanner?.text ||
      "Limited Time Deals",
    description:
      activeContent?.banners?.promoBanner?.subtext ||
      "Fresh drops and exclusive prices are live now.",
    image:
      activeContent?.banners?.promoBanner?.image ||
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=2070&auto=format&fit=crop",
    discountValue: "",
    discountType: "",
    couponCode: "",
    remainingTime: 0,
  };
  const displayOffers = safeOffers.length > 0 ? safeOffers : [fallbackOffer];
  const activeOffer = displayOffers[currentOffer] || displayOffers[0];

  const videoProducts = [...sections.hotSell, ...sections.trending, ...sections.newArrivals]
    .filter((product) => product?.video?.url || product?.video)
    .slice(0, 4);

  const hasAnyProducts =
    sections.hotSell.length > 0 ||
    sections.men.length > 0 ||
    sections.women.length > 0 ||
    sections.trending.length > 0 ||
    sections.newArrivals.length > 0;

  const hotSellNode =
    sections.hotSell?.length > 0 ? (
      <SectionWrapper
        title="HOT SELL"
        subtitle="Lowest price and 50%+ deals"
        viewAllPath="/collection/trending"
        bgColor="bg-white"
        padding="py-6 md:py-9"
      >
        <ProductGridFallback products={sections.hotSell} />
      </SectionWrapper>
    ) : null;

  const trendingNode =
    sections.trending?.length > 0 ? (
      <SectionWrapper
        title="Trending"
        subtitle="Top selling products with strong reviews"
        viewAllPath="/collection/trending"
      >
        <ProductGridFallback products={sections.trending} />
      </SectionWrapper>
    ) : null;

  const promoBannerNode =
    activeOffer ? (
      <section className="py-7 md:py-12 bg-slate-50/50">
        <div className="container-responsive">
          <div className="w-full max-w-none mx-auto relative group">
            <div className="relative rounded-3xl md:rounded-[2.5rem] overflow-hidden shadow-luxury bg-slate-900 aspect-[4/5] sm:aspect-square lg:aspect-[21/9] xl:aspect-[25/9]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeOffer.id || activeOffer._id || currentOffer}
                  initial={{ opacity: 0, scale: 1.05 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.6, ease: "circOut" }}
                  className="absolute inset-0"
                >
                  <SafeImage
                    src={
                      activeOffer.image ||
                      activeOffer.imageUrl ||
                      "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=2070"
                    }
                    alt={activeOffer.title || "Exclusive Offer"}
                    wrapperClassName="absolute inset-0 w-full h-full"
                    className="object-cover"
                    priority
                  />

                  <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/20 to-black/85" />

                  <div className="absolute inset-0 flex flex-col justify-center items-center text-center p-5 md:p-12">
                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.36em] md:tracking-[0.4em] text-white/70 mb-3 md:mb-4"
                    >
                      Exclusive Offer
                    </motion.p>

                    <motion.h2
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="text-4xl sm:text-5xl md:text-7xl font-black uppercase tracking-tighter text-white mb-2 leading-none"
                    >
                      {activeOffer.discountValue || activeOffer.discount
                        ? `${activeOffer.discountValue || activeOffer.discount}${activeOffer.discountType === "percentage" ? "%" : ""} OFF`
                        : "SPECIAL OFFER"}
                    </motion.h2>

                    <motion.h3
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="text-sm md:text-xl font-bold uppercase tracking-tight text-white/90 max-w-sm mb-5 md:mb-6"
                    >
                      {activeOffer.title || "Limited Time Offer"}
                    </motion.h3>

                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3 }}
                      className="flex flex-col items-center gap-4 w-full"
                    >
                      <OfferCountdown
                        status={activeOffer.status}
                        remainingTime={activeOffer.remainingTime}
                      />

                      {activeOffer.couponCode && (
                        <div className="flex items-center bg-white/10 backdrop-blur-md border border-white/20 rounded-full p-1 w-full max-w-[280px] md:max-w-xs mt-1 md:mt-2">
                          <div className="flex-1 px-3 md:px-4 py-2 text-center text-white font-mono font-black tracking-widest text-xs md:text-sm">
                            {activeOffer.couponCode}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              handleCopyCoupon(activeOffer.couponCode)
                            }
                            className="px-5 md:px-6 py-2 bg-white text-black font-black text-[10px] tracking-widest uppercase rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all"
                          >
                            Copy
                          </button>
                        </div>
                      )}
                    </motion.div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {displayOffers.length > 1 && (
              <>
                <div className="absolute top-1/2 -translate-y-1/2 -left-4 md:-left-8 flex items-center">
                  <button
                    type="button"
                    aria-label="Previous offer"
                    onClick={() =>
                      setCurrentOffer(
                        (prev) => (prev - 1 + displayOffers.length) % displayOffers.length
                      )
                    }
                  className="w-9 h-9 md:w-12 md:h-12 rounded-full bg-white shadow-xl flex items-center justify-center text-black hover:bg-slate-100 transition-all border border-slate-100"
                  >
                    <ChevronLeft size={20} />
                  </button>
                </div>

                <div className="absolute top-1/2 -translate-y-1/2 -right-4 md:-right-8 flex items-center">
                  <button
                    type="button"
                    aria-label="Next offer"
                    onClick={() =>
                      setCurrentOffer((prev) => (prev + 1) % displayOffers.length)
                    }
                  className="w-9 h-9 md:w-12 md:h-12 rounded-full bg-white shadow-xl flex items-center justify-center text-black hover:bg-slate-100 transition-all border border-slate-100"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>

                <div className="flex justify-center gap-2 mt-6">
                  {displayOffers.map((offer, index) => (
                    <button
                      key={offer.id || offer._id || `offer-dot-${index}`}
                      type="button"
                      aria-label={`Go to offer ${index + 1}`}
                      onClick={() => setCurrentOffer(index)}
                      className={`h-1.5 transition-all duration-500 rounded-full ${index === currentOffer
                          ? "w-8 bg-slate-900"
                          : "w-2 bg-slate-200"
                        }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    ) : null;

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

      <div className="py-2 md:py-4 space-y-4 md:space-y-8">
        {hotSellNode}
        {!hasAnyProducts && (
          <SectionWrapper
            title="Hot Sell"
            subtitle="Products are loading from store inventory"
            viewAllPath="/collection/hot-sale"
            bgColor="bg-white"
            padding="py-7 md:py-9"
          >
            <ProductGridFallback products={[]} />
          </SectionWrapper>
        )}
        {sections.men.length > 0 && (
          <SectionWrapper
            title="Men"
            subtitle="Men collection"
            viewAllPath="/collection/men"
            bgColor="bg-white"
            padding="py-5 md:py-8"
          >
            <ProductGridFallback products={sections.men.slice(0, 10)} />
          </SectionWrapper>
        )}
        {sections.women.length > 0 && (
          <SectionWrapper
            title="Women"
            subtitle="Women collection"
            viewAllPath="/collection/women"
            bgColor="bg-white"
            padding="py-5 md:py-8"
          >
            <ProductGridFallback products={sections.women.slice(0, 10)} />
          </SectionWrapper>
        )}
        <HomepageVideoStrip products={videoProducts} />
        {trendingNode}
        {promoBannerNode}

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

function HomepageVideoStrip({ products }) {
  const videoItems = Array.isArray(products)
    ? products
      .map((product) => ({
        id: product?.id || product?._id,
        title: product?.title || product?.name || "Product video",
        video: resolveVideoUrl(product?.video?.url || product?.video),
        image: product?.primaryImage || product?.image || product?.images?.[0],
      }))
      .filter((item) => item.video)
    : [];

  if (!videoItems.length) return null;

  return (
    <section className="py-7 md:py-8 bg-slate-950 text-white overflow-hidden">
      <div className="container-responsive">
        <div className="flex items-end justify-between gap-4 mb-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.32em] text-white/45">
              In motion
            </p>
            <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tight">
              Product Videos
            </h2>
          </div>
          <Link
            to="/collection"
            className="text-[10px] font-black uppercase tracking-widest text-white/70 hover:text-white"
          >
            View collection
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {videoItems.map((item) => (
            <Link
              key={item.id || item.video}
              to={item.id ? `/product/${encodeURIComponent(item.id)}` : "/collection"}
              className="group relative aspect-[3/4] overflow-hidden rounded-lg bg-slate-900"
            >
              <SafeImage
                src={item.image}
                alt={item.title}
                wrapperClassName="absolute inset-0"
                className="object-cover opacity-70 group-hover:opacity-0 transition-opacity duration-300"
              />
              <video
                src={item.video}
                className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                muted
                loop
                playsInline
                preload="metadata"
                onMouseEnter={(event) => event.currentTarget.play().catch(() => {})}
                onMouseLeave={(event) => {
                  event.currentTarget.pause();
                  event.currentTarget.currentTime = 0;
                }}
              />
              <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                <p className="text-xs font-black uppercase tracking-widest line-clamp-1">
                  {item.title}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- FALLBACK GRID ---------------- */
function ProductGridFallback({ products }) {
  const safeProducts = Array.isArray(products)
    ? Array.from(
      new Map(
        products
          .filter((product) => product && typeof product === "object")
          .map((product) => [
            String(product?._id || product?.id || product?.slug || product?.name || product?.title),
            product,
          ])
      ).values()
    )
    : [];

  if (!safeProducts.length) {
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
    <div className={`${safeProducts.length === 1 ? "grid grid-cols-1 max-w-[170px] mx-auto md:max-w-none md:grid-cols-5 xl:grid-cols-7" : "grid grid-cols-2 md:grid-cols-5 xl:grid-cols-7"} gap-2.5 md:gap-3 px-4 md:px-0 auto-rows-fr`}>
      {safeProducts.map((product, index) => (
        <ProductCard
          key={product.id || product._id?.toString?.() || `home-product-${index}`}
          product={product}
          priority={index < 4}
        />
      ))}
    </div>
  );
}
