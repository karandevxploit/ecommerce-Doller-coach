import { memo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore, useCartStore, useWishlistStore } from "../store";
import { Heart, ShoppingBag, Eye } from "lucide-react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { formatPrice } from "../utils/format";
import QuickSizeSelector from "./QuickSizeSelector";
import QuickView from "./ui/QuickView";
import LazyImage from "./ui/LazyImage";
import { resolveImageUrl } from "../utils/url";
import { useActionGuard } from "../hooks/useActionGuard";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=800&auto=format&fit=crop";

const ProductCard = memo(function ProductCard({
  product = {},
  layout = "vertical"
}) {
  const navigate = useNavigate();
  const { isAuthenticated, openAuthModal } = useAuthStore();
  const { addToCart } = useCartStore();
  const { toggleWishlist, isInWishlist } = useWishlistStore();

  const [showSizeSelector, setShowSizeSelector] = useState(false);
  const [showQuickView, setShowQuickView] = useState(false);
  const [loading, setLoading] = useState(false);

  /* ---------------- SAFE DATA ---------------- */
  const productId = product?.id || product?._id?.toString?.();
  const isWishlisted = isInWishlist?.(productId);
  const price = product?.price ?? 0;
  const originalPrice = product?.originalPrice ?? price;
  const stock = product?.stock ?? 0;

  const discount =
    originalPrice > price
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : 0;

  const isHorizontal = layout === "horizontal";

  // Resolve image and provide fallback
  const rawImage = product?.images?.[0] || product?.image;
  const imageUrl = rawImage ? resolveImageUrl(rawImage) : FALLBACK_IMAGE;

  const { guardAction } = useActionGuard();

  /* ---------------- ACTIONS ---------------- */
  const handleAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!productId) return;
    if (stock <= 0) return toast.error("Out of stock");

    // Guard Logic
    guardAction("ADD_TO_CART", { productId, variantIdx: 0 }, async () => {
      if (product?.variants?.length > 0) {
        setShowSizeSelector(true);
        return;
      }

      setLoading(true);
      try {
        await addToCart(productId, 1);
        toast.success("Added to cart");
      } catch {
        toast.error("Failed to add item");
      } finally {
        setLoading(false);
      }
    });
  };

  const handleBuyNow = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    guardAction("BUY_NOW", { productId }, () => {
      // Logic for buy now (usually add to cart then navigate to checkout)
      navigate(`/product/${productId}?buynow=true`);
    });
  };

  const handleWishlist = (e) => {
    e.preventDefault();
    e.stopPropagation();

    guardAction("WISHLIST", { productId }, () => {
      toggleWishlist(productId);
    });
  };

  const handleQuickView = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowQuickView(true);
  };

  /* ---------------- UI ---------------- */
  return (
    <>
      <article
        className={`group relative flex flex-col transition ${isHorizontal ? "flex-row gap-6" : "w-full"
          }`}
      >
        <Link
          to={productId ? `/product/${productId}` : "#"}
          className={`flex w-full ${isHorizontal ? "flex-row gap-6" : "flex-col"
            }`}
        >
          {/* IMAGE */}
          <div
            className={`relative overflow-hidden bg-slate-50 ${isHorizontal
              ? "w-32 md:w-48 aspect-[3/4]"
              : "w-full aspect-[3/4]" // Taller aspect ratio for luxury fashion feel
              }`}
          >
            <LazyImage
              src={imageUrl}
              alt={product?.title || "Product"}
              className="group-hover:scale-110 !transition-transform !duration-700 !ease-[cubic-bezier(0.25,0.46,0.45,0.94)] object-cover"
              wrapperClassName="w-full h-full"
            />

            {/* Discount */}
            {discount > 0 && (
              <span className="absolute top-0 left-0 bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 m-3 z-10">
                {discount}% OFF
              </span>
            )}

            {/* Wishlist */}
            <button
              onClick={handleWishlist}
              aria-label="Add to wishlist"
              className="absolute top-3 right-3 p-2 z-10 transition-transform hover:scale-110 focus:outline-none"
            >
              <Heart
                size={20}
                className={`transition-colors duration-300 drop-shadow-md ${isWishlisted ? "text-red-500 fill-red-500" : "text-white hover:text-red-400"
                  }`}
              />
            </button>

            {/* Desktop Hover Actions */}
            <div className="hidden md:flex absolute inset-x-0 bottom-0 p-4 translate-y-full opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 ease-out bg-gradient-to-t from-black/60 to-transparent gap-2 z-10">
              <button
                onClick={handleAddToCart}
                disabled={loading}
                className="flex-1 bg-white text-black font-semibold text-xs tracking-wider uppercase py-3 hover:bg-black hover:text-white transition-colors duration-300"
              >
                {loading ? "Adding..." : "Add to Case"}
              </button>

              <button
                onClick={handleQuickView}
                className="px-4 bg-white/90 hover:bg-white text-black transition-colors duration-300 flex justify-center items-center"
              >
                <Eye size={18} />
              </button>
            </div>
          </div>

          {/* DETAILS */}
          <div className={`flex-1 flex flex-col gap-1 ${isHorizontal ? "pt-2 md:pt-4" : "pt-4"}`}>
            <div className="flex justify-between items-start gap-2">
              <h3 className="text-sm md:text-base font-semibold text-slate-900 line-clamp-1 uppercase tracking-tight">
                {product?.title || "Luxury Item"}
              </h3>
            </div>

            <p className="text-xs text-slate-500 uppercase tracking-widest">
              {product?.brand || "Exclusive Collection"}
            </p>

            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm font-bold text-slate-900 tracking-wide">
                {price > 0 ? formatPrice(price) : "Contact Us"}
              </span>

              {originalPrice > price && (
                <span className="text-xs text-slate-400 line-through tracking-wide">
                  {formatPrice(originalPrice)}
                </span>
              )}
            </div>
          </div>
        </Link>

        {/* MOBILE ACTION */}
        <button
          onClick={handleAddToCart}
          disabled={loading}
          className="md:hidden mt-3 w-full py-3 text-xs font-semibold uppercase tracking-widest bg-black text-white hover:bg-slate-800 transition-colors"
        >
          {loading ? "Adding..." : "Add"}
        </button>
      </article>

      {/* QUICK VIEW */}
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

      {/* SIZE SELECTOR */}
      <AnimatePresence>
        {showSizeSelector && (
          <QuickSizeSelector
            product={product}
            onSelect={({ color, size, variantIdx }) => {
              addToCart(productId, 1, size, null, null, color, variantIdx);
              setShowSizeSelector(false);
              toast.success("Added to cart");
            }}
            onClose={() => setShowSizeSelector(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
});

export default ProductCard;