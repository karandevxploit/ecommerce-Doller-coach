import { useEffect, useRef } from "react";

/**
 * ScrollingTextBanner - Infinite horizontal scroll animation
 * Brand name "DOLLER COACH" scrolls smoothly from right to left
 */
export default function ScrollingTextBanner({ 
  text = "DOLLER COACH",
  speed = 30, // seconds for one complete loop
  className = ""
}) {
  const containerRef = useRef(null);

  // Duplicate text multiple times for seamless infinite scroll
  const repeatedText = Array(10).fill(text).join(" • ");

  return (
    <div 
      ref={containerRef}
      className={`relative w-full overflow-hidden bg-[#0f172a] py-6 ${className}`}
    >
      {/* Gradient overlays for fade effect on edges */}
      <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-[#0f172a] to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-[#0f172a] to-transparent z-10 pointer-events-none" />
      
      {/* Scrolling container */}
      <div className="flex animate-scroll-infinite">
        {/* First set of text */}
        <div 
          className="flex-shrink-0 whitespace-nowrap px-4"
          style={{ animationDuration: `${speed}s` }}
        >
          <span className="text-white/60 text-sm md:text-base lg:text-lg font-black uppercase tracking-[0.3em]">
            {repeatedText}
          </span>
        </div>
        
        {/* Duplicate for seamless loop */}
        <div 
          className="flex-shrink-0 whitespace-nowrap px-4"
          style={{ animationDuration: `${speed}s` }}
        >
          <span className="text-white/60 text-sm md:text-base lg:text-lg font-black uppercase tracking-[0.3em]">
            {repeatedText}
          </span>
        </div>
      </div>

      <style>{`
        @keyframes scroll-infinite {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        
        .animate-scroll-infinite {
          animation: scroll-infinite ${speed}s linear infinite;
          display: flex;
          width: max-content;
        }
        
        /* Pause on hover for accessibility */
        .animate-scroll-infinite:hover {
          animation-play-state: paused;
        }
        
        /* Responsive adjustments */
        @media (max-width: 768px) {
          .animate-scroll-infinite {
            animation-duration: ${speed * 0.7}s;
          }
        }
        
        @media (min-width: 1440px) {
          .animate-scroll-infinite {
            animation-duration: ${speed * 1.3}s;
          }
        }
      `}</style>
    </div>
  );
}
