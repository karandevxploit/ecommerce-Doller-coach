import { useState, useEffect } from "react";
import { Image as ImageIcon } from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { resolveImageUrl } from "../../utils/url";

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const FALLBACK_IMAGE =
  "https://via.placeholder.com/400x500?text=Image+Unavailable";

export default function LazyImage({
  src,
  alt,
  className,
  wrapperClassName,
  priority = false,
  aspect = "aspect-[4/5]"
}) {
  const [imageSrc, setImageSrc] = useState(resolveImageUrl(src));
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const resolved = resolveImageUrl(src);
    setImageSrc(resolved);
    setIsLoaded(false);
    setHasError(false);
  }, [src]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    if (imageSrc !== FALLBACK_IMAGE) {
      setImageSrc(FALLBACK_IMAGE);
    } else {
      setHasError(true);
    }
  };

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden bg-slate-50",
        aspect,
        wrapperClassName
      )}
      role="img"
      aria-label={alt || "Product image"}
    >
      {/* Skeleton */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 z-0 bg-slate-100 animate-pulse flex items-center justify-center">
          <ImageIcon className="text-slate-300" size={28} />
        </div>
      )}

      {/* Error State */}
      {hasError ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-slate-400 gap-2 border border-dashed border-slate-200 bg-slate-100">
          <ImageIcon size={26} className="opacity-60" />
          <span className="text-xs">Image not available</span>
        </div>
      ) : (
        <img
          src={imageSrc}
          alt={alt || "Product image"}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            "w-full h-full object-cover transition-all duration-500 ease-out",
            isLoaded ? "opacity-100 blur-0" : "opacity-0 blur-sm",
            className
          )}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        />
      )}
    </div>
  );
}