import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ShoppingBag,
  Star,
  Heart,
  Share2,
  ShieldCheck,
  Truck
} from "lucide-react";
import { formatPrice } from "../../utils/format";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";

export default function QuickView({
  product = {},
  isOpen,
  onClose,
  onAddToCart
}) {
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [imageError, setImageError] = useState(false);

  const variants = product?.variants || [];

  // Reset on product change
  useEffect(() => {
    setSelectedColor(variants?.[0]?.color || "");
    setSelectedSize("");
    setImageError(false);
  }, [product]);

  // ESC close
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    if (isOpen) window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen || !product) return null;

  const currentVariant =
    variants.find((v) => v.color === selectedColor) || variants[0];

  const imageSrc =
    !imageError && (product?.images?.[0] || product?.image)
      ? product.images?.[0] || product.image
      : "https://via.placeholder.com/500x600?text=Image";

  const handleAddToCart = () => {
    if (variants.length > 0 && !selectedSize) {
      return toast.error("Please select a size");
    }

    onAddToCart?.(selectedSize, selectedColor);
    toast.success("Added to cart");
    onClose?.();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Product quick view"
        >
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative bg-white w-full max-w-4xl rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
          >
            {/* Close */}
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-3 right-3 z-10 p-2 bg-white rounded-full shadow hover:bg-slate-100"
            >
              <X size={18} />
            </button>

            {/* Image */}
            <div className="w-full md:w-1/2 bg-slate-100">
              <img
                src={imageSrc}
                alt={product?.title || "Product"}
                onError={() => setImageError(true)}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Content */}
            <div className="w-full md:w-1/2 p-6 overflow-y-auto flex flex-col gap-5">

              {/* Title */}
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>{product?.category?.main || "Product"}</span>
                  <span className="flex items-center gap-1">
                    <Star size={12} className="text-yellow-500" />
                    {product?.ratings?.average || 4.5}
                  </span>
                </div>

                <h2 className="text-xl font-bold text-slate-900 mt-1">
                  {product?.title || "Product name"}
                </h2>
              </div>

              {/* Price */}
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-slate-900">
                  {formatPrice(product?.price || 0)}
                </span>
                {product?.originalPrice > product?.price && (
                  <span className="text-sm line-through text-slate-400">
                    {formatPrice(product?.originalPrice)}
                  </span>
                )}
              </div>

              {/* Description */}
              <p className="text-sm text-slate-600">
                {product?.description || "No description available."}
              </p>

              {/* Variants */}
              {variants.length > 0 && (
                <div className="space-y-4">

                  {/* Colors */}
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">
                      Color
                    </p>
                    <div className="flex gap-2">
                      {variants.map((v) => (
                        <button
                          key={v.color}
                          onClick={() => setSelectedColor(v.color)}
                          className={`w-7 h-7 rounded-full border ${selectedColor === v.color
                              ? "border-black"
                              : "border-gray-200"
                            }`}
                          style={{ backgroundColor: v.color }}
                          aria-label={`Select ${v.color}`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Sizes */}
                  {currentVariant?.sizes?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">
                        Size
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        {currentVariant.sizes.map((s) => (
                          <button
                            key={s.size}
                            disabled={s.stock <= 0}
                            onClick={() => setSelectedSize(s.size)}
                            className={`px-3 py-1 text-sm rounded border ${s.stock <= 0
                                ? "bg-gray-100 text-gray-400"
                                : selectedSize === s.size
                                  ? "bg-black text-white"
                                  : "bg-white hover:border-black"
                              }`}
                          >
                            {s.size}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-3 mt-2">
                <button
                  onClick={handleAddToCart}
                  className="w-full py-3 bg-black text-white rounded-lg font-semibold hover:bg-indigo-600 transition"
                >
                  Add to cart
                </button>

                <div className="flex gap-2">
                  <button className="flex-1 border py-2 rounded-lg text-sm hover:bg-slate-50">
                    <Heart size={14} /> Wishlist
                  </button>
                  <button className="flex-1 border py-2 rounded-lg text-sm hover:bg-slate-50">
                    <Share2 size={14} /> Share
                  </button>
                </div>
              </div>

              {/* Trust */}
              <div className="flex justify-between text-xs text-slate-500 border-t pt-3">
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