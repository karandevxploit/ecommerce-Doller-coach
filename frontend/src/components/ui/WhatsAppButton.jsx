import React, { useMemo } from "react";
import { FaWhatsapp } from "react-icons/fa";
import { motion, useReducedMotion } from "framer-motion";

const WhatsAppButton = ({
  phone = "917409713036",
  message = "Hello Doller Coach! I'm interested in your premium collection and need some assistance.",
  className = "",
}) => {
  const prefersReducedMotion = useReducedMotion();

  const whatsappUrl = useMemo(() => {
    const cleanPhone = String(phone || "").replace(/\D/g, "");
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message || "")}`;
  }, [phone, message]);

  return (
    <motion.a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      initial={prefersReducedMotion ? false : { scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={prefersReducedMotion ? undefined : { scale: 1.1 }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.9 }}
      className={`whatsapp-btn fixed bottom-20 md:bottom-6 right-6 z-[999] flex items-center justify-center w-14 h-14 bg-[#25D366] text-white rounded-full shadow-[0_10px_25px_rgba(37,211,102,0.4)] transition-all duration-300 group ${className}`}
      aria-label="Contact support on WhatsApp"
    >
      <FaWhatsapp size={32} className="drop-shadow-md" />

      <span className="absolute right-full mr-4 px-4 py-2 bg-black/80 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-white/10">
        Chat with us
      </span>
    </motion.a>
  );
};

WhatsAppButton.displayName = "WhatsAppButton";

export default React.memo(WhatsAppButton);
