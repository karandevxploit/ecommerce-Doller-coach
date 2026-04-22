import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight, Zap } from "lucide-react";
import { resolveImageUrl } from "../../utils/url";
import { Link } from "react-router-dom";

export default function LuxuryHero({ slides = [] }) {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // ================= SLIDE NAV =================
  const nextSlide = useCallback(() => {
    if (!slides.length) return;
    setCurrent((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    if (!slides.length) return;
    setCurrent((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  }, [slides.length]);

  // ================= AUTO PLAY =================
  useEffect(() => {
    if (slides.length <= 1 || isPaused) return;
    const timer = setInterval(nextSlide, 5000);
    return () => clearInterval(timer);
  }, [nextSlide, slides.length, isPaused]);

  // ================= FALLBACK =================
  const displaySlides = slides.length > 0 ? slides : [{
    heading: "Discover New Arrivals",
    subheading: "Explore the latest collection",
    image: "https://images.unsplash.com/photo-1445205170230-053b83016050?q=80&w=2071&auto=format&fit=crop", // high-end fashion fallback
    offer: null
  }];

  const slide = displaySlides[current] || displaySlides[0];

  // ================= SAFE OFFER =================
  const isOfferActive = (() => {
    try {
      if (!slide.offer?.enabled) return false;
      const now = new Date();
      const start = slide.offer.startDate ? new Date(slide.offer.startDate) : null;
      const end = slide.offer.endDate ? new Date(slide.offer.endDate) : null;
      if (start && now < start) return false;
      if (end && now > end) return false;
      return true;
    } catch {
      return false;
    }
  })();

  return (
    <section
      className="relative h-[80vh] w-full overflow-hidden bg-black"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="absolute inset-0"
        >
          {/* IMAGE */}
          <img
            src={resolveImageUrl(slide.image) || "https://images.unsplash.com/photo-1445205170230-053b83016050?q=80&w=2071&auto=format&fit=crop"}
            alt={slide.heading || "Discover New Arrivals"}
            className="w-full h-full object-cover object-top"
          />

          {/* OVERLAY for Luxury Dark Tone */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />

          {/* CONTENT */}
          <div className="absolute inset-0 flex items-center justify-center md:items-end md:justify-start">
            <div className="container-responsive pb-20 md:pb-32 w-full text-center md:text-left z-10 flex flex-col items-center md:items-start text-white max-w-3xl space-y-6">

              {/* OFFER */}
              {isOfferActive && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-medium uppercase tracking-wider border border-white/20"
                >
                  <Zap size={14} className="text-yellow-400" />
                  {slide.offer?.text || "Special Offer"}
                </motion.div>
              )}

              {/* SUB */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-sm md:text-base font-medium tracking-[0.2em] uppercase text-gray-300"
              >
                {slide.subheading || "Explore the latest collection"}
              </motion.p>

              {/* TITLE */}
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-5xl md:text-7xl font-bold leading-tight"
              >
                {slide.heading || "Discover New Arrivals"}
              </motion.h1>

              {/* BUTTONS */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="flex gap-4 pt-4"
              >
                <Link
                  to="/collection"
                  aria-label="Shop now"
                  className="px-8 py-4 bg-white text-black font-semibold text-sm uppercase tracking-widest rounded transition-transform hover:scale-105 hover:bg-gray-100 flex items-center gap-3"
                >
                  Shop Now <ArrowRight size={18} />
                </Link>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* NAV DOTS */}
      {displaySlides.length > 1 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3 z-20">
          {displaySlides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${current === i ? "w-8 bg-white" : "w-3 bg-white/40 hover:bg-white/70"
                }`}
            />
          ))}
        </div>
      )}

      {/* ARROWS (Hidden on mobile for cleaner look) */}
      {displaySlides.length > 1 && (
        <div className="hidden md:flex absolute top-1/2 -translate-y-1/2 left-0 right-0 justify-between px-8 z-20 pointer-events-none">
          <button onClick={prevSlide} className="p-3 pointer-events-auto bg-black/20 hover:bg-white text-white hover:text-black rounded-full backdrop-blur transition-all">
            <ChevronLeft size={24} />
          </button>
          <button onClick={nextSlide} className="p-3 pointer-events-auto bg-black/20 hover:bg-white text-white hover:text-black rounded-full backdrop-blur transition-all">
            <ChevronRight size={24} />
          </button>
        </div>
      )}
    </section>
  );
}