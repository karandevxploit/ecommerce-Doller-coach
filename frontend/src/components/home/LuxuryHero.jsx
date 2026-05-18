import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import SafeImage from "../ui/SafeImage";

const FALLBACK_SLIDE = {
  heading: "Discover New Arrivals",
  subheading: "Explore the latest collection",
  image:
    "https://images.unsplash.com/photo-1445205170230-053b83016050?q=80&w=2071&auto=format&fit=crop",
  offer: null,
  link: "/collection",
};

const isValidDate = (value) => {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

const isOfferActive = (offer) => {
  try {
    if (!offer?.enabled) return false;

    const now = new Date();
    const start = isValidDate(offer.startDate) ? new Date(offer.startDate) : null;
    const end = isValidDate(offer.endDate) ? new Date(offer.endDate) : null;

    if (start && now < start) return false;
    if (end && now > end) return false;

    return true;
  } catch {
    return false;
  }
};

const normalizeSlide = (slide = {}) => ({
  heading: slide.heading || slide.title || FALLBACK_SLIDE.heading,
  subheading: slide.subheading || slide.subtitle || FALLBACK_SLIDE.subheading,
  image: slide.image || slide.imageUrl || FALLBACK_SLIDE.image,
  offer: slide.offer || null,
  link: slide.link || slide.ctaLink || FALLBACK_SLIDE.link,
});

export default function LuxuryHero({ slides = [] }) {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const displaySlides = useMemo(() => {
    const safeSlides = Array.isArray(slides)
      ? slides.filter(Boolean).map(normalizeSlide)
      : [];

    return safeSlides.length > 0 ? safeSlides : [FALLBACK_SLIDE];
  }, [slides]);

  useEffect(() => {
    if (current > displaySlides.length - 1) {
      setCurrent(0);
    }
  }, [current, displaySlides.length]);

  const nextSlide = useCallback(() => {
    setCurrent((prev) => (prev + 1) % displaySlides.length);
  }, [displaySlides.length]);

  const prevSlide = useCallback(() => {
    setCurrent((prev) => (prev === 0 ? displaySlides.length - 1 : prev - 1));
  }, [displaySlides.length]);

  useEffect(() => {
    if (displaySlides.length <= 1 || isPaused) return;

    const timer = setInterval(nextSlide, 5000);
    return () => clearInterval(timer);
  }, [nextSlide, displaySlides.length, isPaused]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (displaySlides.length <= 1) return;
      if (event.key === "ArrowRight") nextSlide();
      if (event.key === "ArrowLeft") prevSlide();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [displaySlides.length, nextSlide, prevSlide]);

  const slide = displaySlides[current] || displaySlides[0];
  const showOffer = isOfferActive(slide.offer);

  return (
    <section
      className="relative h-[52vh] min-h-[360px] md:h-[72vh] w-full overflow-hidden bg-black"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={`${current}-${slide.heading}`}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="absolute inset-0"
        >
          <SafeImage
            src={slide.image}
            alt={slide.heading || "Discover New Arrivals"}
            wrapperClassName="absolute inset-0 w-full h-full"
            className="w-full h-full object-cover object-top"
            priority
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/30 to-black/5" />

          <div className="absolute inset-0 flex items-end justify-center md:justify-start">
            <div className="container-responsive pb-12 md:pb-20 w-full text-center md:text-left z-10 flex flex-col items-center md:items-start text-white max-w-3xl space-y-3 md:space-y-4">
              {showOffer && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 md:px-4 rounded-full text-[10px] md:text-xs font-medium uppercase tracking-wider border border-white/20"
                >
                  <Zap size={14} className="text-yellow-400" />
                  {slide.offer?.text || "Special Offer"}
                </motion.div>
              )}

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-[10px] md:text-sm font-semibold tracking-[0.28em] md:tracking-[0.2em] uppercase !text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)]"
              >
                {slide.subheading || FALLBACK_SLIDE.subheading}
              </motion.p>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-4xl sm:text-5xl md:text-6xl font-black leading-[0.95] uppercase tracking-tight !text-white drop-shadow-[0_3px_18px_rgba(0,0,0,0.75)]"
              >
                {slide.heading || FALLBACK_SLIDE.heading}
              </motion.h1>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="flex gap-4 pt-2 md:pt-4"
              >
                <Link
                  to={slide.link || FALLBACK_SLIDE.link}
                  aria-label="Shop now"
                  className="px-7 py-3 md:px-8 md:py-3.5 bg-white text-black font-black text-xs uppercase tracking-widest rounded transition-transform hover:scale-105 hover:bg-gray-100 flex items-center gap-3"
                >
                  Shop Now <ArrowRight size={18} />
                </Link>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {displaySlides.length > 1 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3 z-20">
          {displaySlides.map((item, index) => (
            <button
              type="button"
              key={`${item.heading}-${index}`}
              aria-label={`Go to slide ${index + 1}`}
              onClick={() => setCurrent(index)}
              className={`h-1.5 rounded-full transition-all duration-300 ${current === index ? "w-8 bg-white" : "w-3 bg-white/40 hover:bg-white/70"
                }`}
            />
          ))}
        </div>
      )}

      {displaySlides.length > 1 && (
        <div className="flex absolute top-1/2 -translate-y-1/2 left-0 right-0 justify-between px-3 md:px-8 z-20 pointer-events-none">
          <button
            type="button"
            aria-label="Previous slide"
            onClick={prevSlide}
            className="p-2.5 md:p-3 pointer-events-auto bg-black/35 hover:bg-white text-white hover:text-black rounded-full backdrop-blur transition-all border border-white/20"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            type="button"
            aria-label="Next slide"
            onClick={nextSlide}
            className="p-2.5 md:p-3 pointer-events-auto bg-black/35 hover:bg-white text-white hover:text-black rounded-full backdrop-blur transition-all border border-white/20"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      )}
    </section>
  );
}
