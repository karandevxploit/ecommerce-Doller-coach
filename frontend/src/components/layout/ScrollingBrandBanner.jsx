import { useMemo } from "react";

const DEFAULT_BRAND_NAME = "DOLLER COACH";

export default function ScrollingBrandBanner({
  text = DEFAULT_BRAND_NAME,
  className = "",
}) {
  const items = useMemo(() => Array.from({ length: 12 }, () => text), [text]);

  const renderItems = (prefix) =>
    items.map((item, index) => (
      <span
        key={`${prefix}-${index}`}
        className="text-white/22 hover:text-white/80 transition-all duration-700 text-2xl md:text-4xl lg:text-5xl font-black uppercase tracking-[0.35em] px-6 md:px-12 gpu-accelerated cursor-default"
      >
        {item}
        <span className="text-sky-400/25 ml-6 md:ml-12" aria-hidden="true">
          ◆
        </span>
      </span>
    ));

  return (
    <div
      className={`relative w-full overflow-hidden bg-[#060b18] py-6 md:py-8 border-y border-slate-900 select-none ${className}`}
      aria-label={text}
    >
      <div className="absolute left-0 top-0 bottom-0 w-24 md:w-48 bg-gradient-to-r from-slate-950 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-24 md:w-48 bg-gradient-to-l from-slate-950 to-transparent z-10 pointer-events-none" />

      <div className="flex whitespace-nowrap animate-scroll-slow hover:[animation-play-state:paused] transition-all duration-500 motion-reduce:animate-none" aria-hidden="true">
        <div className="flex items-center">{renderItems("set1")}</div>
        <div className="flex items-center">{renderItems("set2")}</div>
      </div>

      <div className="absolute inset-0 bg-white/[0.01] backdrop-blur-[1px] pointer-events-none" />
    </div>
  );
}
