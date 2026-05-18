import { useEffect, useMemo, useState } from "react";
import { X, ShoppingBag } from "lucide-react";
import { motion } from "framer-motion";
import { resolveImageUrl } from "../utils/url";

const safeArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

const getVariantSizes = (variant) => {
  if (!variant) return [];

  if (Array.isArray(variant.sizes)) {
    return variant.sizes
      .map((item) => {
        if (typeof item === "string") return item;
        return item?.size || item?.name || item?.label;
      })
      .filter(Boolean);
  }

  return [variant.size].filter(Boolean);
};

const getColorValue = (variant) => {
  return variant?.color || variant?.colorName || variant?.name || "";
};

export default function QuickSizeSelector({ product, onSelect, onClose }) {
  const variants = useMemo(() => safeArray(product?.variants), [product?.variants]);

  const colors = useMemo(() => {
    const productColors = safeArray(product?.colors);

    if (productColors.length) {
      return [...new Set(productColors.map(String))];
    }

    return [
      ...new Set(
        variants
          .map((variant) => getColorValue(variant))
          .filter(Boolean)
          .map(String)
      ),
    ];
  }, [product?.colors, variants]);

  const globalSizes = useMemo(() => {
    const productSizes = safeArray(product?.sizes);

    if (productSizes.length) {
      return [
        ...new Set(
          productSizes
            .map((item) => {
              if (typeof item === "string") return item;
              return item?.size || item?.name || item?.label;
            })
            .filter(Boolean)
            .map(String)
        ),
      ];
    }

    return [
      ...new Set(
        variants
          .flatMap((variant) => getVariantSizes(variant))
          .filter(Boolean)
          .map(String)
      ),
    ];
  }, [product?.sizes, variants]);

  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);

  useEffect(() => {
    setSelectedColor(colors.length === 1 ? colors[0] : null);
    setSelectedSize(globalSizes.length === 1 ? globalSizes[0] : null);
  }, [colors, globalSizes]);

  const availableSizes = useMemo(() => {
    if (!selectedColor || !variants.length) return globalSizes;

    const sizesForColor = [
      ...new Set(
        variants
          .filter((variant) => getColorValue(variant) === selectedColor)
          .flatMap((variant) => getVariantSizes(variant))
          .filter(Boolean)
          .map(String)
      ),
    ];

    return sizesForColor.length ? sizesForColor : globalSizes;
  }, [selectedColor, variants, globalSizes]);

  useEffect(() => {
    if (selectedSize && availableSizes.length && !availableSizes.includes(selectedSize)) {
      setSelectedSize(null);
    }
  }, [availableSizes, selectedSize]);

  if (!product) return null;

  /* ---------------- EMPTY OPTIONS ---------------- */
  if (!colors.length && !globalSizes.length) {
    return (
      <div className="absolute inset-0 z-50 bg-white p-6 rounded-3xl flex flex-col items-center justify-center text-center">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          No options available
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 text-[10px] font-black underline"
        >
          Close
        </button>
      </div>
    );
  }

  const isValid =
    (colors.length ? Boolean(selectedColor) : true) &&
    (globalSizes.length ? Boolean(selectedSize) : true);

  const handleConfirm = () => {
    if (!isValid) return;

    const variantIndex = variants.findIndex((item) => {
      const colorMatches = colors.length
        ? getColorValue(item) === selectedColor
        : true;

      const sizeMatches = globalSizes.length
        ? getVariantSizes(item).includes(selectedSize)
        : true;

      return colorMatches && sizeMatches;
    });
    const variant = variantIndex >= 0 ? variants[variantIndex] : null;

    onSelect?.({
      color: selectedColor,
      size: selectedSize,
      variantIdx: variantIndex >= 0 ? variantIndex : undefined,
      variantId: variant?._id || variant?.id,
      image: variant?.image || variant?.imageUrl || product?.image,
      variant,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="absolute inset-0 z-50 bg-white/98 backdrop-blur-xl p-6 flex flex-col justify-between rounded-3xl shadow-luxury border border-slate-100"
    >
      <div className="flex justify-between items-center mb-4">
        <div>
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Quick Selection
          </h4>

          <p className="text-[11px] font-black truncate max-w-[140px] uppercase tracking-tighter">
            {product?.title || product?.name || "Product"}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close size selector"
          className="h-8 w-8 flex items-center justify-center hover:bg-slate-100 rounded-xl transition-all"
        >
          <X size={16} className="text-slate-900" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 scrollbar-hide py-2">
        {/* COLORS */}
        {colors.length > 0 && (
          <div className="space-y-3">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              Select Color
            </p>

            <div className="flex flex-wrap gap-2.5">
              {colors.map((color) => {
                const variant = variants.find(
                  (item) => getColorValue(item) === color
                );

                const image =
                  variant?.image || variant?.imageUrl || variant?.thumbnail;

                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={`group relative h-10 w-10 rounded-full border-2 transition-all p-0.5 ${selectedColor === color
                        ? "border-slate-900 scale-110 shadow-lg"
                        : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                    title={color}
                    aria-label={`Select color ${color}`}
                  >
                    {image ? (
                      <img
                        src={resolveImageUrl(image)}
                        className="w-full h-full rounded-full object-cover"
                        alt={color}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="w-full h-full rounded-full bg-slate-200 flex items-center justify-center text-[8px] font-black">
                        {String(color).charAt(0)}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* SIZES */}
        {globalSizes.length > 0 && (
          <div className="space-y-3">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              Select Size
            </p>

            <div className="flex flex-wrap gap-1.5">
              {globalSizes.map((size) => {
                const isAvailable = availableSizes.includes(size);

                return (
                  <button
                    key={size}
                    type="button"
                    disabled={!isAvailable}
                    onClick={() => setSelectedSize(size)}
                    className={`h-10 min-w-[44px] px-3 rounded-xl text-[10px] font-black transition-all border-2 ${selectedSize === size
                        ? "bg-slate-900 border-slate-900 text-white shadow-md"
                        : isAvailable
                          ? "bg-white text-slate-900 border-slate-100 hover:border-slate-300"
                          : "bg-slate-50 text-slate-300 border-transparent cursor-not-allowed opacity-50"
                      }`}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleConfirm}
        disabled={!isValid}
        className="w-full py-4 bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-luxury flex items-center justify-center gap-3 hover:bg-black transition-all disabled:opacity-20 active:scale-95 mt-4 group"
      >
        <ShoppingBag
          size={14}
          className="group-hover:rotate-12 transition-transform"
        />
        Commit to Selection
      </button>
    </motion.div>
  );
}
