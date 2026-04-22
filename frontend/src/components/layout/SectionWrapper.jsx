import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function SectionWrapper({
  title,
  subtitle,
  children,
  viewAllPath = "/collection",
  viewAllText = "View all",
  bgColor = "bg-white",
  padding = "py-16 lg:py-24",
  hideViewAll = false
}) {
  const safeTitle = title || "Section";
  const safeSubtitle = subtitle || "";

  return (
    <section className={`${bgColor} ${padding}`} aria-labelledby="section-heading">
      <div className="container-responsive space-y-10 lg:space-y-16">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">

          <div className="space-y-2 max-w-2xl">
            {safeSubtitle && (
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                {safeSubtitle}
              </span>
            )}

            <h2
              id="section-heading"
              className="text-2xl md:text-4xl lg:text-5xl font-bold text-slate-900 leading-tight"
            >
              {safeTitle}
            </h2>
          </div>

          {/* View All */}
          {!hideViewAll && viewAllPath && (
            <Link
              to={viewAllPath}
              aria-label={`View all ${safeTitle}`}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-indigo-600 transition"
            >
              {viewAllText}
              <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" />
            </Link>
          )}

        </div>

        {/* Content */}
        <div className="relative w-full">
          {children || (
            <div className="text-sm text-slate-400">
              No content available.
            </div>
          )}
        </div>

      </div>
    </section>
  );
}