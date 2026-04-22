import React from "react";
import { MessageCircle } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * WhatsApp Floating Button
 * Configurable, accessible, and optimized for UX
 */
const WhatsAppButton = ({
  phoneNumber = "919690668290",
  message = "Hi, I need help with my order.",
  className = ""
}) => {
  const prefersReducedMotion = useReducedMotion();

  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;

  return (
    <motion.a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      title="Chat on WhatsApp"
      initial={prefersReducedMotion ? false : { scale: 0.8, opacity: 0 }}
      animate={prefersReducedMotion ? {} : { scale: 1, opacity: 1 }}
      whileHover={prefersReducedMotion ? {} : { scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
      className={`fixed bottom-24 md:bottom-8 right-5 z-[999] flex items-center justify-center w-14 h-14 bg-green-500 text-white rounded-full shadow-lg hover:shadow-xl transition ${className}`}
    >
      {/* Icon */}
      <MessageCircle size={26} />

      {/* Pulse (only if motion allowed) */}
      {!prefersReducedMotion && (
        <span className="absolute inset-0 rounded-full bg-white/20 animate-ping" />
      )}

      {/* Tooltip (accessible) */}
      <span className="sr-only">Chat with us on WhatsApp</span>

      {/* Desktop Tooltip */}
      <span className="absolute right-full mr-3 px-3 py-1.5 bg-slate-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition whitespace-nowrap hidden md:block">
        Chat with us
      </span>
    </motion.a>
  );
};

export default React.memo(WhatsAppButton);