import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { X } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

/**
 * FloatingVideo
 * Product preview video with controlled visibility + UX improvements
 */
const FloatingVideo = ({ videoUrl }) => {
  const { id } = useParams();
  const prefersReducedMotion = useReducedMotion();

  const [visible, setVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const videoRef = useRef(null);
  const timerRef = useRef(null);

  /* ---------------- VISIBILITY ---------------- */
  useEffect(() => {
    if (!videoUrl || !id) return;

    clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      setVisible(true);
    }, 1000);

    return () => {
      clearTimeout(timerRef.current);
      setVisible(false);
    };
  }, [id, videoUrl]);

  /* ---------------- VIDEO CONTROL ---------------- */
  useEffect(() => {
    if (!videoRef.current) return;

    if (isHovered) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => { });
    }
  }, [isHovered]);

  const handleClose = (e) => {
    e.stopPropagation();
    setVisible(false);
  };

  if (!videoUrl) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          transition={{ duration: 0.3 }}
          role="dialog"
          aria-label="Product preview video"
          className="fixed bottom-20 md:bottom-6 right-4 md:right-6 w-[160px] md:w-[180px] aspect-[9/16] z-[9999] rounded-xl overflow-hidden bg-black border border-white/10 shadow-xl"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Close */}
          <button
            onClick={handleClose}
            aria-label="Close video"
            className="absolute top-2 right-2 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition"
          >
            <X size={16} />
          </button>

          {/* Video */}
          <video
            ref={videoRef}
            src={videoUrl}
            muted
            loop
            playsInline
            autoPlay
            preload="metadata"
            className="w-full h-full object-cover"
          />

          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

          {/* Label */}
          <div className="absolute bottom-2 w-full text-center pointer-events-none">
            <span className="text-[10px] text-white/70 font-medium">
              Product preview
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default React.memo(FloatingVideo);