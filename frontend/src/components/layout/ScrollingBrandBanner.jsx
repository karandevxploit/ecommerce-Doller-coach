import React from "react";

/**
 * ScrollingBrandBanner - Modern, animated infinite loop brand banner.
 * Features: High-contrast aesthetic, edge gradients, and hover pause.
 */
const ScrollingBrandBanner = () => {
  const brandName = "DOLLER COACH";
  // Repeat text enough times to fill the screen twice for seamless looping
  const items = Array(12).fill(brandName);

  return (
    <div className="relative w-full overflow-hidden bg-slate-950 py-10 md:py-14 border-y border-white/5 select-none">
      {/* Premium Edge Gradients for smooth fade effect */}
      <div className="absolute left-0 top-0 bottom-0 w-24 md:w-48 bg-gradient-to-r from-slate-950 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-24 md:w-48 bg-gradient-to-l from-slate-950 to-transparent z-10 pointer-events-none" />

      {/* Scrolling Track */}
      <div className="flex whitespace-nowrap animate-scroll-infinite hover:[animation-play-state:paused] transition-all duration-500">
        {/* Set 1 */}
        <div className="flex items-center">
          {items.map((text, i) => (
            <span
              key={`set1-${i}`}
              className="text-white/30 hover:text-white/90 transition-all duration-700 text-3xl md:text-5xl lg:text-7xl font-black uppercase tracking-[0.4em] px-8 md:px-16 gpu-accelerated cursor-default"
            >
              {text}
              <span className="text-indigo-500/30 ml-8 md:ml-16">◆</span>
            </span>
          ))}
        </div>

        {/* Set 2 (Duplicate for seamless loop) */}
        <div className="flex items-center">
          {items.map((text, i) => (
            <span
              key={`set2-${i}`}
              className="text-white/30 hover:text-white/90 transition-all duration-700 text-3xl md:text-5xl lg:text-7xl font-black uppercase tracking-[0.4em] px-8 md:px-16 gpu-accelerated cursor-default"
            >
              {text}
              <span className="text-indigo-500/30 ml-8 md:ml-16">◆</span>
            </span>
          ))}
        </div>
      </div>

      {/* Optional: Subtle Glassmorphism Overlay */}
      <div className="absolute inset-0 bg-white/[0.01] backdrop-blur-[1px] pointer-events-none" />
    </div>
  );
};

export default ScrollingBrandBanner;
