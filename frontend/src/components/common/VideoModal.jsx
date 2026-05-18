import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { getVideoPoster } from "../../utils/url";

const VideoModal = ({ videoUrl = "", isOpen = false, onClose = () => { } }) => {
  const [hasError, setHasError] = useState(false);

  const poster = useMemo(() => {
    return videoUrl ? getVideoPoster(videoUrl) : "";
  }, [videoUrl]);

  useEffect(() => {
    if (!isOpen) return;

    setHasError(false);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, videoUrl]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 md:p-12"
          onClick={onClose}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close video"
            className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all z-10"
          >
            <X size={24} />
          </button>

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative w-full max-w-6xl aspect-video rounded-[2rem] overflow-hidden shadow-2xl border border-white/5 bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            {videoUrl && !hasError ? (
              <video
                src={videoUrl}
                poster={poster}
                autoPlay
                muted
                controls
                loop
                playsInline
                className="w-full h-full object-contain"
                onError={() => setHasError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/50 text-sm font-bold uppercase tracking-widest">
                Video unavailable
              </div>
            )}
          </motion.div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center pointer-events-none">
            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">
              Cinematic Gallery Experience
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VideoModal;
