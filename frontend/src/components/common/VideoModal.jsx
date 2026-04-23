import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { getVideoPoster } from '../../utils/url';

/**
 * CINEMATIC VIDEO MODAL
 * Provides a premium, full-screen video viewing experience.
 */
const VideoModal = ({ videoUrl, isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 md:p-12"
      onClick={onClose}
    >
      {/* Close Button */}
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all z-10"
      >
        <X size={24} />
      </button>

      {/* Video Container */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-6xl aspect-video rounded-[2rem] overflow-hidden shadow-2xl border border-white/5 bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <video 
          src={videoUrl}
          poster={getVideoPoster(videoUrl)}
          autoPlay 
          muted 
          controls 
          loop
          playsInline
          className="w-full h-full object-contain"
        />
      </motion.div>

      {/* Floating Info */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Cinematic Gallery Experience</p>
      </div>
    </motion.div>
  );
};

export default VideoModal;
