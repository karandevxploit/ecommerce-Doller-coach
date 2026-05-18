import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import logo from "@/assets/logo.png";

export default function GlobalLoader({
  isVisible = false,
  title = "Doller Coach",
  message = "Loading your experience...",
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="global-loader"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{
            opacity: 0,
            transition: { duration: prefersReducedMotion ? 0 : 0.5 },
          }}
          role="status"
          aria-live="polite"
          aria-label="Loading content"
          className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.6 }}
            className="absolute inset-0 bg-slate-50"
          />

          <div className="relative flex flex-col items-center gap-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                duration: prefersReducedMotion ? 0 : 0.4,
              }}
              className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-md border border-slate-100"
            >
              <img src={logo} alt="Doller Coach" className="h-12 w-12 object-contain" />
            </motion.div>

            <div className="text-center">
              <motion.h1
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: prefersReducedMotion ? 0 : 0.2 }}
                className="text-base font-bold text-slate-900"
              >
                {title.includes(" ") ? (
                  <>
                    {title.split(" ")[0]}{" "}
                    <span className="text-indigo-600">
                      {title.split(" ").slice(1).join(" ")}
                    </span>
                  </>
                ) : (
                  title
                )}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: prefersReducedMotion ? 0 : 0.4 }}
                className="text-xs text-slate-500"
              >
                {message}
              </motion.p>
            </div>
          </div>

          {!prefersReducedMotion && (
            <div className="absolute bottom-12 w-28 h-[2px] bg-slate-200 rounded-full overflow-hidden">
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="w-full h-full bg-indigo-600"
              />
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
