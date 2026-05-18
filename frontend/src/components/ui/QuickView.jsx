import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Star,
  Heart,
  Share2,
  ShieldCheck,
  Truck,
  Timer,
} from "lucide-react";
import { formatPrice } from "../../utils/format";
import { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import { useCartStore, useWishlistStore } from "../../store";

const PLACEHOLDER_IMAGE = "https://via.placeholder.com/500x600?text=Image";

const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isValidDate = (value) => {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

const fallbackCopy = (text) => {
  if (typeof document === "undefined") return false;

  const textarea = document.createElement("textarea");

  try {
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    textarea.style.opacity = "0";

    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, text.length);

    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    if (textarea.parentNode) {
      document.body.removeChild(textarea);
    }
  }
};

const Countdown = ({ expiry }) => {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    if (!isValidDate(expiry)) {
      setTimeLeft("");
      return;
    }

    const update = () => {
      const diff = new Date(expiry).getTime() - Date.now();

      if (diff <= 0) {
        setTimeLeft("Expired");
        return;
      }

      const hrs = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff / (1000 * 60)) % 60);
      const secs = Math.floor((diff / 1000) % 60);

      setTimeLeft(`${hrs}h ${mins}m ${secs}s left`);
    };

    update();

    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiry]);

  if (!timeLeft) return null;

  return (
    <div className="flex items-center gap-1.5 text-yellow-300 font-black text-xs uppercase tracking-tighter bg-black/20 px-2 py-1 rounded backdrop-blur-sm">
      <Timer size={12} />
      <span>{timeLeft}</span>
    </div>
  );
};

export default function QuickView({
  product = {},
  isOpen = false,
  onClose = () => { },
}) {
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [imageError, setImageError] = useState(false);

  const { addToCart } = useCartStore();
  const { toggleWishlist, isInWishlist } = useWishlistStore();

  const productId = product?.id || product?._id || "";

  const uniqueColors = useMemo(() => {
    const colors = product?.colors || product?.variants?.map((variant) => variant?.color) || [];
    return [...new Set(Array.isArray(colors) ? colors.filter(Boolean) : [])];
  }, [product]);

  const uniqueSizes = useMemo(() => {
    const directSizes = Array.isArray(product?.sizes) ? product.sizes : [];
    const variantSizes = Array.isArray(product?.variants)
      ? product.variants.flatMap((variant) => {
        if (Array.isArray(variant?.sizes)) {
          return variant.sizes.map((size) =>
            typeof size === "object" ? size?.size : size
          );
        }

        return variant?.size ? [variant.size] : [];
      })
      : [];

    return [...new Set([...directSizes, ...variantSizes].filter(Boolean))];
  }, [product]);

  useEffect(() => {
    if (!isOpen) return;

    setSelectedColor(uniqueColors[0] || "");
    setSelectedSize(uniqueSizes[0] || "");
    setImageError(false);
  }, [isOpen, productId, uniqueColors, uniqueSizes]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKey = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, onClose]);

  const imageSrc =
    !imageError && (product?.images?.[0] || product?.image)
      ? product.images?.[0] || product.image
      : PLACEHOLDER_IMAGE;

  const handleAddToCart = async () => {
    if (!productId) {
      toast.error("Product unavailable");
      return;
    }

    const finalSize = selectedSize || uniqueSizes[0] || "";
    const finalColor = selectedColor || uniqueColors[0] || "";

    try {
      await addToCart(productId, 1, finalSize, null, null, finalColor);
      toast.success("Added to cart");
      onClose();
    } catch (err) {
      console.error("QUICK_VIEW_ADD_TO_CART_ERROR:", err);
      toast.error(err?.response?.data?.message || "Failed to add to cart");
    }
  };

  const handleWishlist = async () => {
    if (!productId) {
      toast.error("Product unavailable");
      return;
    }

    try {
      await toggleWishlist(productId);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Wishlist update failed");
    }
  };

  const handleShare = async () => {
    if (!productId) return;

    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/product/${productId}`
        : `/product/${productId}`;

    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: product.title || product.name || "Product",
          text: "Check this out!",
          url,
        });
      } else if (
        typeof navigator !== "undefined" &&
        navigator.clipboard?.writeText
      ) {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied!");
      } else if (fallbackCopy(url)) {
        toast.success("Link copied!");
      } else {
        toast.error("Unable to copy link");
      }
    } catch (err) {
      if (err?.name !== "AbortError") {
        toast.error("Unable to share");
      }
    }
  };

  const isWishlisted = productId ? isInWishlist(productId) : false;
  const price = safeNumber(product?.price);
  const originalPrice = safeNumber(product?.originalPrice);

  return (
    <AnimatePresence>
      {isOpen && product && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
          aria-label={product?.title || product?.name || "Product quick view"}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative bg-white w-full max-w-4xl rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close quick view"
              className="absolute top-3 right-3 z-10 p-2 bg-white rounded-full shadow hover:bg-slate-100"
            >
              <X size={18} />
            </button>

            <div className="w-full md:w-1/2 bg-slate-100">
              <img
                src={imageSrc}
                alt={product?.title || product?.name || "Product"}
                onError={() => setImageError(true)}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="w-full md:w-1/2 p-6 overflow-y-auto flex flex-col gap-5">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>
                    {product?.category?.name || product?.category?.main || "Product"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Star size={12} className="text-yellow-500" />
                    {safeNumber(product?.ratings?.average, 4.5)}
                  </span>
                </div>

                <h2 className="text-xl font-bold text-slate-900 mt-1">
                  {product?.title || product?.name || "Product name"}
                </h2>

                {product?.offer?.isActive && product?.offer?.title && (
                  <div className="bg-gradient-to-br from-red-500 to-rose-600 text-white p-4 rounded-2xl shadow-lg mt-3 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 bg-white/10 rounded-full blur-2xl" />
                    <div className="relative z-10 space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h3 className="font-black uppercase tracking-tight text-lg leading-tight flex items-center gap-1.5">
                            {product.offer.title}
                            {product.offer.discount && (
                              <span className="bg-white text-red-600 px-1.5 py-0.5 rounded text-[10px]">
                                {product.offer.discount}
                              </span>
                            )}
                          </h3>
                          {product.offer.couponCode && (
                            <p className="mt-1 inline-flex items-center gap-1.5 bg-black/20 px-2 py-1 rounded-lg text-[9px] font-bold tracking-widest uppercase">
                              Code:{" "}
                              <span className="text-white text-xs">
                                {product.offer.couponCode}
                              </span>
                            </p>
                          )}
                        </div>
                        {product.offer.expiryDate && (
                          <Countdown expiry={product.offer.expiryDate} />
                        )}
                      </div>

                      {isValidDate(product.offer.startDate) &&
                        isValidDate(product.offer.expiryDate) && (
                          <p className="text-[8px] font-bold opacity-75 uppercase tracking-widest border-t border-white/20 pt-2">
                            Valid:{" "}
                            {new Date(product.offer.startDate).toLocaleDateString()} -{" "}
                            {new Date(product.offer.expiryDate).toLocaleDateString()}
                          </p>
                        )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-slate-900">
                  {formatPrice(price)}
                </span>
                {originalPrice > price && (
                  <span className="text-sm line-through text-slate-400">
                    {formatPrice(originalPrice)}
                  </span>
                )}
              </div>

              <p className="text-sm text-slate-600">
                {product?.description || "No description available."}
              </p>

              <div className="space-y-4">
                {uniqueColors.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">
                      Color
                    </p>
                    <div className="flex gap-2">
                      {uniqueColors.map((color) => {
                        const variant = product.variants?.find(
                          (item) => item?.color === color
                        );
                        const hex = variant?.colorCode || color;

                        return (
                          <button
                            type="button"
                            key={color}
                            onClick={() => setSelectedColor(color)}
                            className={`w-7 h-7 rounded-full border ${selectedColor === color
                                ? "border-black shadow-md"
                                : "border-gray-200"
                              } flex items-center justify-center`}
                            style={{ backgroundColor: hex }}
                            title={color}
                            aria-label={`Select color ${color}`}
                          >
                            {!String(hex).startsWith("#") && hex !== color && (
                              <span className="text-[8px] text-slate-400">
                                {color.charAt(0)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {uniqueSizes.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">
                      Size
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {uniqueSizes.map((size) => (
                        <button
                          type="button"
                          key={size}
                          onClick={() => setSelectedSize(size)}
                          className={`px-3 py-1 text-sm rounded border ${selectedSize === size
                              ? "bg-black text-white"
                              : "bg-white hover:border-black"
                            }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 mt-2">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="w-full py-3 bg-black text-white rounded-lg font-semibold hover:bg-slate-800 transition"
                >
                  Add to cart
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleWishlist}
                    className={`flex-1 border py-2 rounded-lg text-sm transition-colors ${isWishlisted
                        ? "bg-red-50 text-red-600 border-red-200"
                        : "hover:bg-slate-50"
                      }`}
                  >
                    <Heart
                      size={14}
                      className={
                        isWishlisted
                          ? "fill-red-600 inline mr-1"
                          : "inline mr-1"
                      }
                    />
                    {isWishlisted ? "Saved" : "Wishlist"}
                  </button>

                  <button
                    type="button"
                    onClick={handleShare}
                    className="flex-1 border py-2 rounded-lg text-sm hover:bg-slate-50"
                  >
                    <Share2 size={14} className="inline mr-1" /> Share
                  </button>
                </div>
              </div>

              <div className="flex justify-between text-xs text-slate-500 border-t pt-3 mt-auto">
                <span className="flex items-center gap-1">
                  <ShieldCheck size={14} /> Quality checked
                </span>
                <span className="flex items-center gap-1">
                  <Truck size={14} /> Fast delivery
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
