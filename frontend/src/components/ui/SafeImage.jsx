import { useState, useEffect } from "react";
import { Image as ImageIcon } from "lucide-react";
import { resolveImageUrl } from "../../utils/url";

/**
 * SafeImage Component
 * Handles invalid src, fallback, loading state, and accessibility
 */

const PLACEHOLDER_IMAGE =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iNTAwIiB2aWV3Qm94PSIwIDAgNDAwIDUwMCI+PHJlY3Qgd2lkdGg9IjQwMCIgaGVpZ2h0PSI1MDAiIGZpbGw9IiNmMWY1ZjkiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOTRhM2I4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Tk8gSU1BR0U8L3RleHQ+PC9zdmc+";

export default function SafeImage({
  src,
  alt = "Image",
  className = "",
  wrapperClassName = "",
  fallback = PLACEHOLDER_IMAGE,
  priority = false,
  ...props
}) {
  const [imageSrc, setImageSrc] = useState(resolveImageUrl(src));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const resolved = resolveImageUrl(src);
    setImageSrc(resolved);
    setLoading(true);
    setError(false);
  }, [src]);

  const handleLoad = () => setLoading(false);

  const handleError = () => {
    if (imageSrc !== fallback) {
      setImageSrc(fallback);
    } else {
      setError(true);
      setLoading(false);
    }
  };

  const isValidSrc =
    imageSrc && typeof imageSrc === "string" && imageSrc.trim().length > 0;

  return (
    <div
      className={`relative bg-slate-50 overflow-hidden ${wrapperClassName}`}
      role="img"
      aria-label={alt}
    >
      {/* Skeleton */}
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 animate-pulse">
          <ImageIcon size={24} className="text-slate-300" />
        </div>
      )}

      {/* Image */}
      {isValidSrc && !error ? (
        <img
          src={imageSrc}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          className={`w-full h-full object-cover transition-opacity duration-300 ${loading ? "opacity-0" : "opacity-100"
            } ${className}`}
          {...props}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
          Image not available
        </div>
      )}
    </div>
  );
}

/**
 * Category-based fallback
 */
export function getCategoryFallback(category) {
  const fallbacks = {
    clothing: PLACEHOLDER_IMAGE,
    electronics: PLACEHOLDER_IMAGE,
    shoes: PLACEHOLDER_IMAGE,
    accessories: PLACEHOLDER_IMAGE,
    default: PLACEHOLDER_IMAGE
  };

  return fallbacks[category?.toLowerCase()] || fallbacks.default;
}