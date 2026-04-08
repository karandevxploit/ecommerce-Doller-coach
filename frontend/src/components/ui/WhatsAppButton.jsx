import React from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import { motion } from 'framer-motion';

const WhatsAppButton = () => {
  const phoneNumber = "919690668290";
  const whatsappUrl = `https://wa.me/${phoneNumber}`;

  return (
    <motion.a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.1, rotate: 5 }}
      whileTap={{ scale: 0.9 }}
      className="fixed bottom-24 md:bottom-8 right-6 z-[999] flex items-center justify-center w-14 h-14 bg-[#25D366] text-white rounded-full shadow-[0_10px_25px_-5px_rgba(37,211,102,0.4)] transition-all duration-300 hover:shadow-[0_15px_30px_-5px_rgba(37,211,102,0.6)] group"
      aria-label="Contact us on WhatsApp"
    >
      <div className="relative">
        <FaWhatsapp size={32} className="relative z-10" />
        {/* Subtle pulse animation */}
        <span className="absolute inset-0 rounded-full bg-white opacity-20 animate-ping group-hover:hidden"></span>
      </div>
      
      {/* Tooltip for desktop */}
      <span className="absolute right-full mr-4 px-4 py-2 bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap hidden md:block shadow-xl">
        Chat with Specialists
      </span>
    </motion.a>
  );
};

export default WhatsAppButton;
