import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Zap, Clock } from "lucide-react";
import { Link } from "react-router-dom";

// Countdown Timer (Safe + Clean)
const CountdownTimer = ({ targetDate }) => {
  const calculateTime = () => {
    const now = Date.now();
    const distance = new Date(targetDate).getTime() - now;

    if (distance <= 0) {
      return { hours: 0, minutes: 0, seconds: 0 };
    }

    return {
      hours: Math.floor((distance / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((distance / (1000 * 60)) % 60),
      seconds: Math.floor((distance / 1000) % 60)
    };
  };

  const [timeLeft, setTimeLeft] = useState(calculateTime());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTime());
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  return (
    <div className="flex gap-2" aria-label="Offer countdown">
      {Object.entries(timeLeft).map(([label, value]) => (
        <div key={label} className="flex flex-col items-center">
          <div className="bg-white/10 border border-white/20 rounded-md w-10 h-10 flex items-center justify-center">
            <span className="text-sm font-bold text-white">
              {String(value).padStart(2, "0")}
            </span>
          </div>
          <span className="text-[9px] text-white/60 capitalize">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
};

const FALLBACK_BANNER = {
  id: "fallback",
  title: "Upgrade Your Everyday Style",
  description: "Shop comfortable, modern outfits made for daily wear.",
  image:
    "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?q=80&w=2070&auto=format&fit=crop",
  link: "/collection",
  cta: "Shop Now",
  badge: "Limited Offer",
  endDate: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
};

export default function HeroCarousel({ offers = [] }) {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const slides = useMemo(() => {
    if (!Array.isArray(offers) || offers.length === 0) {
      return [FALLBACK_BANNER];
    }

    return offers.map((o) => ({
      id: o?.id || o?._id || Math.random(),
      title: o?.title || o?.name || FALLBACK_BANNER.title,
      description: o?.description || FALLBACK_BANNER.description,
      image: o?.image || o?.imageUrl || FALLBACK_BANNER.image,
      link: o?.link || "/collection",
      cta: o?.ctaText || "Shop Now",
      badge: o?.badge || "Special Offer",
      endDate: o?.endDate || FALLBACK_BANNER.endDate
    }));
  }, [offers]);

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const prev = useCallback(() => {
    setCurrent((prev) => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  // Auto Slide (Paused on hover)
  useEffect(() => {
    if (slides.length <= 1 || isPaused) return;

    const timer = setInterval(next, 7000);
    return () => clearInterval(timer);
  }, [next, slides.length, isPaused]);

  return (
    <section
      className="relative w-full h-[60vh] md:h-[80vh] overflow-hidden bg-black"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      aria-label="Promotional offers"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={slides[current].id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0"
        >
          {/* Image */}
          <img
            src={slides[current].image}
            alt={slides[current].title}
            onError={(e) => {
              e.currentTarget.src = FALLBACK_BANNER.image;
            }}
            className="w-full h-full object-cover"
          />

          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />

          {/* Content */}
          <div className="absolute inset-0 flex items-center z-10">
            <div className="max-w-6xl px-6 md:px-16">

              {/* Badge + Timer */}
              <div className="flex flex-wrap items-center gap-4 mb-4">
                <span className="bg-indigo-600 text-white text-xs px-3 py-1 rounded-full font-semibold">
                  {slides[current].badge}
                </span>

                <div className="flex items-center gap-2 text-white/80 text-xs">
                  <Clock size={14} />
                  <CountdownTimer targetDate={slides[current].endDate} />
                </div>
              </div>

              {/* Title */}
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white leading-tight max-w-2xl">
                {slides[current].title}
              </h1>

              {/* Description */}
              <p className="text-sm md:text-lg text-white/80 mt-4 max-w-xl">
                {slides[current].description}
              </p>

              {/* CTA */}
              <div className="flex items-center gap-4 mt-6">
                <Link
                  to={slides[current].link}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black text-sm font-semibold rounded-md hover:bg-indigo-600 hover:text-white transition"
                >
                  {slides[current].cta}
                  <ChevronRight size={18} />
                </Link>

                <span className="hidden sm:flex items-center gap-2 text-white/60 text-xs">
                  <Zap size={14} /> Free delivery available
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Dots */}
      {slides.length > 1 && (
        <div className="absolute bottom-6 right-6 flex gap-2 z-20">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${current === i
                  ? "w-8 bg-white"
                  : "w-2 bg-white/40 hover:bg-white/70"
                }`}
            />
          ))}
        </div>
      )}

      {/* Arrows */}
      {slides.length > 1 && (
        <div className="absolute bottom-6 left-6 flex gap-3 z-20">
          <button
            onClick={prev}
            aria-label="Previous slide"
            className="p-3 bg-white/10 text-white rounded-md hover:bg-indigo-600 transition"
          >
            <ChevronLeft size={20} />
          </button>

          <button
            onClick={next}
            aria-label="Next slide"
            className="p-3 bg-white/10 text-white rounded-md hover:bg-indigo-600 transition"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </section>
  );
}