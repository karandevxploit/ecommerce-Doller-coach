import { useRef } from "react";

/**
 * PremiumScrollingBanner - Advanced infinite scroll with blur/fade effects
 * Features: Motion blur, variable opacity, premium aesthetic
 */
export default function PremiumScrollingBanner({ 
  text = "DOLLER COACH",
  speed = 35,
  className = ""
}) {
  const containerRef = useRef(null);
  
  // Create multiple repeats for density
  const items = Array(8).fill(null).map((_, i) => ({
    id: i,
    text: text,
    separator: "✦"
  }));

  return (
    <div 
      ref={containerRef}
      className={`relative w-full overflow-hidden ${className}`}
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900 to-slate-950" />
      
      {/* Animated blur orbs for depth */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2" />
        <div className="absolute top-1/2 right-1/4 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2" />
      </div>

      {/* Edge fade masks */}
      <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent z-20 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-slate-950 via-slate-950/80 to-transparent z-20 pointer-events-none" />
      
      {/* Main scroll track */}
      <div className="relative py-8 md:py-12">
        <div className="flex animate-premium-scroll">
          {/* First track */}
          <div className="flex-shrink-0 flex items-center">
            {items.map((item, index) => (
              <div 
                key={`a-${item.id}`} 
                className="flex items-center group"
              >
                <span className="text-white/40 group-hover:text-white/70 transition-colors duration-500 text-xs md:text-sm lg:text-base font-black uppercase tracking-[0.4em] px-4 md:px-6 whitespace-nowrap">
                  {item.text}
                </span>
                <span className="text-indigo-400/30 text-xs">{item.separator}</span>
              </div>
            ))}
          </div>
          
          {/* Duplicate track for seamless loop */}
          <div className="flex-shrink-0 flex items-center">
            {items.map((item, index) => (
              <div 
                key={`b-${item.id}`} 
                className="flex items-center group"
              >
                <span className="text-white/40 group-hover:text-white/70 transition-colors duration-500 text-xs md:text-sm lg:text-base font-black uppercase tracking-[0.4em] px-4 md:px-6 whitespace-nowrap">
                  {item.text}
                </span>
                <span className="text-indigo-400/30 text-xs">{item.separator}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes premium-scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        
        .animate-premium-scroll {
          animation: premium-scroll ${speed}s linear infinite;
          display: flex;
          width: max-content;
        }
        
        /* Slow down on hover for readability */}
        .animate-premium-scroll:hover {
          animation-play-state: paused;
        }
        
        /* Smooth will-change for performance */
        .animate-premium-scroll {
          will-change: transform;
        }
        
        /* Reduce motion preference support */
        @media (prefers-reduced-motion: reduce) {
          .animate-premium-scroll {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
