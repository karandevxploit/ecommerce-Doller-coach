import { memo, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCartStore, useWishlistStore } from "../store";
import { Heart, Eye, Play } from "lucide-react";
import toast from "react-hot-toast";
import { AnimatePresence } from "framer-motion";
import { formatPrice } from "../utils/format";
import QuickSizeSelector from "./QuickSizeSelector";
import QuickView from "./ui/QuickView";
import SafeImage from "./ui/SafeImage";
import VideoModal from "./common/VideoModal";
import { FALLBACK_IMAGE_URL, resolveImageUrl, resolveVideoUrl } from "../utils/url";
import { useActionGuard } from "../hooks/useActionGuard";

const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const ProductCard = memo(function ProductCard({
  product = {},
  layout = "vertical",
  priority = false,
}) {
  const { addToCart } = useCartStore();
  const { toggleWishlist, isInWishlist } = useWishlistStore();
  const { guardAction } = useActionGuard();

  const [showSizeSelector, setShowSizeSelector] = useState(false);
  const [showQuickView, setShowQuickView] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const hasProduct = product && Object.keys(product).length > 0;
  const productId = product?.id || product?._id?.toString?.() || "";
  const isHorizontal = layout === "horizontal";

  const price = safeNumber(product?.price);
  const originalPrice = safeNumber(product?.originalPrice, price);
  const stock = safeNumber(product?.stock, 0);
  const stockState = stock <= 0 ? "out" : stock <= 3 ? "low" : "in";

  const discount =
    originalPrice > price && originalPrice > 0
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : 0;

  const rawImage = product?.primaryImage || product?.images?.[0] || product?.image;
  const imageUrl = rawImage ? resolveImageUrl(rawImage) : FALLBACK_IMAGE_URL;
  const videoUrl = product?.video?.url || product?.video || "";
  const isWishlisted = productId ? isInWishlist?.(productId) : false;
  const badge = product?.badge || {};
  const showBadge = Boolean(badge?.enabled && badge?.text);

  const hasVariants = useMemo(() => {
    return Array.isArray(product?.variants) && product.variants.length > 0;
  }, [product?.variants]);

  if (!hasProduct) return null;

  const handleAddToCart = async (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    if (!productId) {
      toast.error("Product unavailable");
      return;
    }

    if (stock <= 0) {
      toast.error("Out of stock");
      return;
    }

    guardAction("ADD_TO_CART", { productId, variantIdx: 0 }, async () => {
      if (hasVariants) {
        setShowSizeSelector(true);
        return;
      }

      setLoading(true);
      try {
        await addToCart(productId, 1);
        toast.success("Added to cart");
      } catch (err) {
        toast.error(err?.response?.data?.message || "Failed to add item");
      } finally {
        setLoading(false);
      }
    });
  };

  const handleWishlist = (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    if (!productId) return;

    guardAction("WISHLIST", { productId }, async () => {
      try {
        await toggleWishlist(productId);
      } catch (err) {
        toast.error(err?.response?.data?.message || "Wishlist update failed");
      }
    });
  };

  const handleQuickView = (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    setShowQuickView(true);
  };

  const productPath = productId ? `/product/${encodeURIComponent(productId)}` : "#";

  return (
    <>
      <article
        className={`group relative flex flex-col transition ${isHorizontal ? "flex-row gap-4" : "w-full rounded-lg border border-slate-200 bg-white p-1 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-slate-300"
          }`}
      >
        <Link
          to={productPath}
          className={`flex w-full ${isHorizontal ? "flex-row gap-6" : "flex-col"
            }`}
        >
          <div
            className={`relative overflow-hidden bg-slate-50 ${isHorizontal ? "w-24 md:w-32 aspect-[3/4]" : "w-full aspect-[3/4] rounded-md"
              }`}
          >
            <SafeImage
              src={imageUrl}
              alt={product?.title || product?.name || "Product"}
              className={`${videoUrl ? "md:group-hover:opacity-0" : ""} group-hover:scale-105 !transition-all !duration-500 !ease-[cubic-bezier(0.25,0.46,0.45,0.94)] object-cover`}
              wrapperClassName="w-full h-full"
              priority={priority}
            />

            {videoUrl && (
              <video
                src={resolveVideoUrl(videoUrl)}
                className="hidden md:block absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                muted
                loop
                playsInline
                preload="metadata"
                onMouseEnter={(event) => event.currentTarget.play().catch(() => {})}
                onMouseLeave={(event) => {
                  event.currentTarget.pause();
                  event.currentTarget.currentTime = 0;
                }}
              />
            )}

            <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
              {showBadge && (
                <span
                  className="text-white text-[8px] font-black uppercase tracking-wider px-2 py-0.5 shadow-sm rounded-sm"
                  style={{ backgroundColor: badge.color || "#0f172a" }}
                >
                  {badge.text}
                </span>
              )}

              {discount > 0 && (
                <span className="bg-red-600 text-white text-[8px] font-black uppercase tracking-wider px-2 py-0.5 shadow-sm rounded-sm">
                  {discount}% OFF
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleWishlist}
              aria-label="Add to wishlist"
              className="absolute top-2 right-2 p-1.5 z-10 rounded-full bg-black/15 backdrop-blur-sm transition-transform hover:scale-110 focus:outline-none"
            >
              <Heart
                size={18}
                className={`transition-colors duration-300 drop-shadow-md ${isWishlisted
                    ? "text-red-500 fill-red-500"
                    : "text-white hover:text-red-400"
                  }`}
              />
            </button>

            {videoUrl && (
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setShowVideoModal(true);
                }}
                className="absolute bottom-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full z-10 hover:bg-black transition-all"
              >
                <div className="w-4 h-4 flex items-center justify-center rounded-full bg-white text-black">
                  <Play size={8} fill="currentColor" />
                </div>
                <span>Play Video</span>
              </button>
            )}

            <div className="hidden md:flex absolute inset-x-0 bottom-0 p-2.5 translate-y-full opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 ease-out bg-gradient-to-t from-black/65 to-transparent gap-2 z-10">
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={loading}
                className="flex-1 bg-white text-black font-black text-[10px] tracking-wider uppercase py-2 hover:bg-black hover:text-white transition-colors duration-300 disabled:opacity-60 rounded-sm"
              >
                {loading ? "Adding..." : "Add to Case"}
              </button>

              <button
                type="button"
                onClick={handleQuickView}
                aria-label="Quick view"
                className="px-3 bg-white/90 hover:bg-white text-black transition-colors duration-300 flex justify-center items-center rounded-sm"
              >
                <Eye size={18} />
              </button>
            </div>
          </div>

          <div
            className={`flex-1 flex flex-col gap-0.5 ${isHorizontal ? "pt-1 md:pt-2" : "px-1.5 pt-2 pb-1"
              }`}
          >
            <div className="flex justify-between items-start gap-2">
              <h3 className="text-[10px] md:text-[11px] font-black text-slate-900 line-clamp-2 uppercase tracking-tight leading-snug min-h-[2.35em]">
                {product?.title || product?.name || "Luxury Item"}
              </h3>
            </div>

            <p className="text-[8px] md:text-[9px] text-slate-500 uppercase tracking-widest line-clamp-1">
              {product?.brand || "Exclusive Collection"}
            </p>

            <p
              className={`text-[8px] font-black uppercase tracking-widest ${
                stockState === "out"
                  ? "text-rose-600"
                  : stockState === "low"
                    ? "text-amber-600"
                    : "text-emerald-600"
              }`}
            >
              {stockState === "out"
                ? "Out of stock"
                : stockState === "low"
                  ? `Only ${stock} left`
                  : "In stock"}
            </p>

            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs md:text-[13px] font-black text-slate-900 tracking-wide">
                {price > 0 ? formatPrice(price) : "Contact Us"}
              </span>

              {originalPrice > price && (
                <span className="text-[10px] text-slate-400 line-through tracking-wide">
                  {formatPrice(originalPrice)}
                </span>
              )}
            </div>
          </div>
        </Link>

        <button
          type="button"
          onClick={handleAddToCart}
          disabled={loading}
          className="md:hidden mt-2 w-full rounded-md py-2 text-[10px] font-black uppercase tracking-widest bg-black text-white hover:bg-slate-800 transition-colors disabled:opacity-60"
        >
          {loading ? "Adding..." : "Add"}
        </button>
      </article>

      <AnimatePresence>
        {showQuickView && (
          <QuickView
            product={product}
            isOpen={showQuickView}
            onClose={() => setShowQuickView(false)}
            onAddToCart={handleAddToCart}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSizeSelector && (
          <QuickSizeSelector
            product={product}
            onSelect={async ({ color, size, variantIdx }) => {
              try {
                await addToCart(productId, 1, size, null, null, color, variantIdx);
                toast.success("Added to cart");
                setShowSizeSelector(false);
              } catch (err) {
                toast.error(err?.response?.data?.message || "Failed to add item");
              }
            }}
            onClose={() => setShowSizeSelector(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showVideoModal && videoUrl && (
          <VideoModal
            videoUrl={videoUrl}
            isOpen={showVideoModal}
            onClose={() => setShowVideoModal(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
});

export default ProductCard;
