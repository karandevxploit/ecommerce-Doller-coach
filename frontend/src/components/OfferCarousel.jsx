import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Zap, ArrowRight, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

/* ---------------- COUNTDOWN ---------------- */
const Countdown = ({ endDate }) => {
  const [timeLeft, setTimeLeft] = useState({ h: "00", m: "00", s: "00" });

  useEffect(() => {
    if (!endDate) return;

    const update = () => {
      const now = Date.now();
      const end = new Date(endDate).getTime();

      if (isNaN(end)) {
        setTimeLeft({ h: "00", m: "00", s: "00" });
        return;
      }

      const diff = Math.max(0, end - now);

      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);

      setTimeLeft({
        h: String(h).padStart(2, "0"),
        m: String(m).padStart(2, "0"),
        s: String(s).padStart(2, "0")
      });
    };

    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [endDate]);

  return (
    <div className="flex gap-1 text-xs">
      {Object.entries(timeLeft).map(([k, v]) => (
        <span key={k} className="px-2 py-1 bg-slate-900 text-white rounded text-[10px]">
          {v}
        </span>
      ))}
    </div>
  );
};

/* ---------------- MAIN ---------------- */
export default function OfferCarousel({ offers = [] }) {
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState(0);
  const prefersReducedMotion = useReducedMotion();
  const navigate = useNavigate();

  const safeOffers = Array.isArray(offers) ? offers : [];

  const paginate = useCallback(
    (dir) => {
      if (!safeOffers.length) return;
      setDirection(dir);
      setActive((prev) => (prev + dir + safeOffers.length) % safeOffers.length);
    },
    [safeOffers.length]
  );

  useEffect(() => {
    if (safeOffers.length <= 1) return;
    const t = setInterval(() => paginate(1), 5000);
    return () => clearInterval(t);
  }, [paginate, safeOffers.length]);

  if (!safeOffers.length) return null;

  const current = safeOffers[active];

  const handleCopy = async () => {
    if (!current?.couponCode) return;

    try {
      await navigator.clipboard.writeText(current.couponCode);
      toast.success("Code copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <section className="w-full py-4 bg-white">
      <div className="max-w-7xl mx-auto px-4">

        <div className="relative overflow-hidden rounded-2xl bg-slate-100 border border-slate-200 h-[380px] md:h-[300px] flex items-center">

          <AnimatePresence initial={false} custom={direction}>
            <motion.div
              key={active}
              custom={direction}
              initial={prefersReducedMotion ? false : { opacity: 0, x: direction > 0 ? 80 : -80 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction > 0 ? -80 : 80 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 flex items-center p-6 md:p-10"
            >
              <div className="flex flex-col md:flex-row items-center justify-between w-full gap-6">

                {/* LEFT */}
                <div className="w-full md:w-3/5 space-y-3 text-center md:text-left">

                  <h2 className="text-2xl md:text-4xl font-bold text-slate-900">
                    {current?.title || "Limited Time Offer"}
                  </h2>

                  <p className="text-sm text-slate-600 max-w-md">
                    {current?.description || "Grab the best deals before they end."}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 justify-center md:justify-start">

                    {current?.couponCode && (
                      <button
                        onClick={handleCopy}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-dashed rounded-lg text-sm hover:bg-slate-50"
                      >
                        <Zap size={14} className="text-indigo-600" />
                        {current.couponCode}
                      </button>
                    )}

                    {current?.endDate && (
                      <Countdown endDate={current.endDate} />
                    )}
                  </div>

                  <button
                    onClick={() => navigate("/collection")}
                    className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-indigo-600 transition"
                  >
                    Shop now <ArrowRight size={14} />
                  </button>
                </div>

                {/* RIGHT IMAGE */}
                <div className="w-full md:w-2/5 flex justify-center">
                  <img
                    src={current?.image || "https://via.placeholder.com/300"}
                    alt={current?.title || "Offer"}
                    className="h-[160px] md:h-[220px] object-contain"
                  />
                </div>

              </div>
            </motion.div>
          </AnimatePresence>

          {/* NAV */}
          {safeOffers.length > 1 && (
            <>
              <button
                onClick={() => paginate(-1)}
                className="absolute left-3 top-1/2 -translate-y-1/2 h-8 w-8 bg-white rounded-full shadow flex items-center justify-center"
              >
                <ChevronLeft size={16} />
              </button>

              <button
                onClick={() => paginate(1)}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 bg-white rounded-full shadow flex items-center justify-center"
              >
                <ChevronRight size={16} />
              </button>
            </>
          )}

          {/* DOTS */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
            {safeOffers.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setDirection(i > active ? 1 : -1);
                  setActive(i);
                }}
                className={`h-1.5 rounded-full transition ${active === i ? "w-6 bg-slate-900" : "w-2 bg-slate-400"
                  }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}