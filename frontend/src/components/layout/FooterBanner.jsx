import ScrollingTextBanner from "./ScrollingTextBanner";
import PremiumScrollingBanner from "./PremiumScrollingBanner";

/**
 * FooterBanner - Pre-configured footer scrolling text
 * Choose between simple or premium variants
 */
export function FooterBannerSimple({ className = "" }) {
  return (
    <ScrollingTextBanner 
      text="DOLLER COACH"
      speed={35}
      className={className}
    />
  );
}

export function FooterBannerPremium({ className = "" }) {
  return (
    <PremiumScrollingBanner 
      text="DOLLER COACH"
      speed={40}
      className={className}
    />
  );
}

/**
 * Minimal Footer Banner using only Tailwind classes
 * No inline styles - uses the global CSS animations
 */
export function FooterBannerMinimal() {
  // Repeat text for seamless loop
  const items = Array(8).fill("DOLLER COACH");
  
  return (
    <div className="relative w-full overflow-hidden bg-slate-950 py-8">
      {/* Edge gradients */}
      <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-slate-950 to-transparent z-10" />
      <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-slate-950 to-transparent z-10" />
      
      {/* Scrolling track - uses global CSS animation */}
      <div className="flex animate-scroll-infinite">
        {/* First set */}
        <div className="flex-shrink-0 flex">
          {items.map((text, i) => (
            <span 
              key={`a-${i}`}
              className="text-white/50 hover:text-white/80 transition-colors text-sm md:text-base font-black uppercase tracking-[0.3em] px-6 md:px-8 whitespace-nowrap"
            >
              {text}
              <span className="text-indigo-400/40 mx-4">◆</span>
            </span>
          ))}
        </div>
        
        {/* Duplicate for seamless loop */}
        <div className="flex-shrink-0 flex">
          {items.map((text, i) => (
            <span 
              key={`b-${i}`}
              className="text-white/50 hover:text-white/80 transition-colors text-sm md:text-base font-black uppercase tracking-[0.3em] px-6 md:px-8 whitespace-nowrap"
            >
              {text}
              <span className="text-indigo-400/40 mx-4">◆</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default FooterBannerMinimal;
