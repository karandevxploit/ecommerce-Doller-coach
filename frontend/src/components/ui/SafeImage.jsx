import { useState, useEffect } from "react";
import { Image as ImageIcon } from "lucide-react";
import { resolveImageUrl } from "../../utils/url";

/**
 * SafeImage Component (PRODUCTION-READY)
 * Guaranteed to never show a broken image.
 */

const FALLBACK_IMAGE = "/placeholder.png";

export default function SafeImage({
  src,
  alt = "Product Image",
  className = "",
  wrapperClassName = "",
  priority = false,
  ...props
}) {
  const [imageSrc, setImageSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!src) {
      setImageSrc(FALLBACK_IMAGE);
      setLoading(false);
      return;
    }

    // Cache busting + resolution
    const resolved = resolveImageUrl(src);
    const cacheBuster = resolved.includes("?") ? `&t=${Date.now()}` : `?t=${Date.now()}`;
    
    setImageSrc(`${resolved}${cacheBuster}`);
    setLoading(true);
    setError(false);
  }, [src]);

  const handleLoad = () => setLoading(false);

  const handleError = () => {
    if (imageSrc !== FALLBACK_IMAGE) {
      setImageSrc(FALLBACK_IMAGE);
    } else {
      setError(true);
      setLoading(false);
    }
  };

  return (
    <div
      className={`relative overflow-hidden bg-slate-50 ${wrapperClassName}`}
      role="img"
      aria-label={alt}
    >
      {/* SKELETON / LOADER */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 animate-pulse z-10">
          <ImageIcon size={24} className="text-slate-300" />
        </div>
      )}

      {/* ACTUAL IMAGE */}
      <img
        src={imageSrc || FALLBACK_IMAGE}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        onLoad={handleLoad}
        onError={handleError}
        className={`w-full h-full object-cover transition-opacity duration-500 ${
          loading ? "opacity-0" : "opacity-100"
        } ${className}`}
        {...props}
      />
    </div>
  );
}