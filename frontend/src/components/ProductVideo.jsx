import React, { useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * ProductVideo
 * Clean, responsive product preview video with controls + fallbacks
 */
const ProductVideo = ({ videoUrl }) => {
  const videoRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();

  const [isPlaying, setIsPlaying] = useState(true);
  const [hasError, setHasError] = useState(false);

  if (!videoUrl || hasError) return null;

  /* ---------------- CONTROLS ---------------- */
  const togglePlay = () => {
    if (!videoRef.current) return;

    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => { });
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleError = () => {
    setHasError(true);
  };

  return (
    <div
      className="w-full max-w-[280px] rounded-xl overflow-hidden border border-slate-200 bg-black shadow-sm"
      role="region"
      aria-label="Product video preview"
    >
      {/* VIDEO */}
      <div className="relative group">
        <video
          ref={videoRef}
          src={videoUrl}
          autoPlay={!prefersReducedMotion}
          muted
          loop
          playsInline
          preload="metadata"
          onError={handleError}
          className="w-full h-full object-cover"
        />

        {/* OVERLAY CONTROL */}
        <button
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause video" : "Play video"}
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/20"
        >
          <motion.div
            initial={false}
            animate={{ scale: 1 }}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white text-slate-900 shadow"
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </motion.div>
        </button>
      </div>

      {/* LABEL */}
      <div className="text-center py-2 text-xs text-slate-500">
        Product preview
      </div>
    </div>
  );
};

export default React.memo(ProductVideo);