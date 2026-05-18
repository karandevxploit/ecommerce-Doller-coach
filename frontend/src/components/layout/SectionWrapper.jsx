import { useId } from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function SectionWrapper({
  title,
  subtitle,
  children,
  viewAllPath = "/collection",
  viewAllText = "View all",
  bgColor = "bg-white",
  padding = "py-7 md:py-12",
  hideViewAll = false,
}) {
  const headingId = useId();
  const safeTitle = title || "Section";
  const safeSubtitle = subtitle || "";
  const safeViewAllText = viewAllText || "View all";

  return (
    <section className={`${bgColor} ${padding}`} aria-labelledby={headingId}>
      <div className="container-responsive space-y-4 md:space-y-5 lg:space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-1.5 md:space-y-2 max-w-2xl">
            {safeSubtitle && (
              <span className="text-[10px] md:text-xs font-semibold text-slate-500 uppercase tracking-widest">
                {safeSubtitle}
              </span>
            )}

            <h2
              id={headingId}
              className="text-xl md:text-3xl lg:text-4xl font-black text-slate-900 leading-tight uppercase tracking-tight"
            >
              {safeTitle}
            </h2>
          </div>

          {!hideViewAll && viewAllPath && (
            <Link
              to={viewAllPath}
              aria-label={`View all ${safeTitle}`}
              className="group inline-flex shrink-0 items-center gap-1 text-[10px] md:text-sm font-black uppercase tracking-widest text-slate-700 hover:text-indigo-600 transition"
            >
              {safeViewAllText}
              <ChevronRight
                size={16}
                className="transition-transform group-hover:translate-x-1"
              />
            </Link>
          )}
        </div>

        <div className="relative w-full">
          {children || (
            <div className="text-sm text-slate-400">No content available.</div>
          )}
        </div>
      </div>
    </section>
  );
}
