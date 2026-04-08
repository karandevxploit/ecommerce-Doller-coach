import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const FloatingVideo = ({ videoUrl }) => {
  const { id } = useParams();
  const [visible, setVisible] = useState(false);

  // Smart Visibility Control:
  // Reset visibility whenever the product ID changes (user opens another product or re-opens same)
  useEffect(() => {
    if (videoUrl && id) {
      const timer = setTimeout(() => setVisible(true), 1200);
      return () => {
        clearTimeout(timer);
        setVisible(false);
      };
    }
  }, [id, videoUrl]);

  const handleClose = (e) => {
    e.stopPropagation();
    setVisible(false);
    // Note: We use local state (visible) so it persists only while on this view.
    // Navigation to another product (changing 'id') will reset it.
  };

  if (!videoUrl) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 30 }}
          className="floating-product-video-container"
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            width: "180px",
            aspectRatio: "9/16",
            zIndex: 9999,
            borderRadius: "20px",
            overflow: "hidden",
            boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
            background: "#000",
            border: "1px solid rgba(255,255,255,0.15)",
            cursor: "pointer"
          }}
        >
          {/* Close Button */}
          <button
            onClick={handleClose}
            className="group"
            style={{
              position: "absolute",
              top: "10px",
              right: "10px",
              zIndex: 10,
              background: "rgba(0,0,0,0.4)",
              backdropFilter: "blur(8px)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "50%",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
            }}
          >
            <X size={16} strokeWidth={3} className="group-hover:scale-110 transition-transform" />
          </button>

          {/* Video Element */}
          <video
            src={videoUrl}
            autoPlay
            muted
            loop
            playsInline
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              pointerEvents: "none"
            }}
          />

          {/* Subtle Overlay Gradient for Depth */}
          <div style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)",
            pointerEvents: "none"
          }} />
          
          <div style={{
            position: "absolute",
            bottom: "12px",
            left: "0",
            right: "0",
            textAlign: "center",
            pointerEvents: "none"
          }}>
            <span style={{ 
              fontSize: "9px", 
              fontWeight: "900", 
              color: "rgba(255,255,255,0.6)", 
              textTransform: "uppercase", 
              letterSpacing: "0.15em",
              textShadow: "0 2px 4px rgba(0,0,0,0.5)"
            }}>
              Product Showcase
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FloatingVideo;
