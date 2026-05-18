import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { safeApi } from "../api/client";
import { ENDPOINTS } from "../api/endpoints";
import {
  ArrowLeft,
  Heart,
  Star,
  ShoppingCart,
  Truck,
  Minus,
  Plus,
  Share2,
  Play,
  Timer,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuthStore, useCartStore, useWishlistStore } from "../store";
import { formatPrice } from "../utils/format";
import { useProductData } from "../hooks";
import SafeImage from "../components/ui/SafeImage";
import ProductCard from "../components/ProductCard";
import VideoModal from "../components/common/VideoModal";
import { INTERNAL_FALLBACK } from "../utils/url";

const safeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const getVariantColor = (variant) =>
  variant?.color || variant?.colorName || variant?.name || "";

const sameText = (a, b) =>
  String(a || "").trim().toLowerCase() ===
  String(b || "").trim().toLowerCase();

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

const getVariantSizeStock = (variant, size) => {
  if (!variant) return null;

  if (Array.isArray(variant.sizes)) {
    const matched = variant.sizes.find((item) => {
      if (typeof item === "string") return sameText(item, size);
      return sameText(item?.size || item?.name || item?.label, size);
    });

    if (matched && typeof matched === "object") {
      const stock = safeNumber(matched.stock ?? matched.qty ?? matched.quantity, NaN);
      return Number.isFinite(stock) ? stock : null;
    }
  }

  const stock = safeNumber(variant.stock ?? variant.qty ?? variant.quantity, NaN);
  return Number.isFinite(stock) ? stock : null;
};

const getProductStock = (product) => {
  const directStock = safeNumber(product?.stock, NaN);
  if (Number.isFinite(directStock)) return directStock;

  return (product?.variants || []).reduce((total, variant) => {
    if (Array.isArray(variant?.sizes)) {
      return total + variant.sizes.reduce((sum, item) => {
        if (typeof item === "string") return sum;
        return sum + safeNumber(item?.stock ?? item?.qty ?? item?.quantity, 0);
      }, 0);
    }
    return total + safeNumber(variant?.stock ?? variant?.qty ?? variant?.quantity, 0);
  }, 0);
};

const getProductSizes = (product) => {
  if (Array.isArray(product?.sizes) && product.sizes.length) {
    return product.sizes
      .map((item) => {
        if (typeof item === "string") return item;
        return item?.size || item?.name || item?.label;
      })
      .filter(Boolean);
  }

  return (product?.variants || []).flatMap(getVariantSizes).filter(Boolean);
};

const getVideoUrl = (video) => {
  if (!video) return "";
  if (typeof video === "string") return video;
  return video.url || video.videoUrl || video.secure_url || "";
};

const getImageValue = (image) => {
  if (!image) return "";
  if (typeof image === "string") return image.trim();
  if (typeof image === "object") {
    return (
      image.url ||
      image.secure_url ||
      image.imageUrl ||
      image.src ||
      image.thumbnail ||
      ""
    ).trim();
  }
  return "";
};

const isUsableGalleryImage = (image) => {
  const value = getImageValue(image);
  if (!value || value.startsWith("/placeholder")) return false;

  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:image/") ||
    value.startsWith("blob:") ||
    value.startsWith("/uploads/") ||
    value.startsWith("uploads/")
  );
};

const safeDate = (date) => {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    day: "numeric",
  });
};

const Countdown = ({ expiry }) => {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const end = new Date(expiry).getTime();
    if (!Number.isFinite(end)) {
      setTimeLeft("");
      return undefined;
    }

    const update = () => {
      const diff = end - Date.now();

      if (diff <= 0) {
        setTimeLeft("Expired");
        return false;
      }

      const hrs = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff / (1000 * 60)) % 60);
      const secs = Math.floor((diff / 1000) % 60);

      setTimeLeft(`${hrs}h ${mins}m ${secs}s left`);
      return true;
    };

    const shouldContinue = update();
    if (!shouldContinue) return undefined;

    const interval = setInterval(() => {
      const keepGoing = update();
      if (!keepGoing) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [expiry]);

  if (!timeLeft) return null;

  return (
    <div className="flex items-center gap-1.5 text-yellow-300 font-black text-sm uppercase tracking-tighter bg-black/20 px-3 py-1.5 rounded-lg backdrop-blur-sm">
      <Timer size={14} />
      <span>{timeLeft}</span>
    </div>
  );
};

const StarRating = ({ rating }) => {
  const safeRating = Math.max(0, Math.min(5, safeNumber(rating)));

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className="text-yellow-400 text-sm">
          {safeRating >= star ? "★" : safeRating >= star - 0.5 ? "★" : "☆"}
        </span>
      ))}
    </div>
  );
};

export default function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const { isAuthenticated } = useAuthStore();
  const { addToCart } = useCartStore();
  const { toggleWishlist, isInWishlist } = useWishlistStore();

  const {
    product,
    reviews,
    avgRating,
    totalReviews,
    related,
    loading,
    error,
    refetch,
  } = useProductData(id);

  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);
  const [activeImage, setActiveImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, comment: "" });

  const reviewsRef = useRef(null);

  const productId = product?.id || product?._id || id;
  const variants = Array.isArray(product?.variants) ? product.variants : [];

  const uniqueColors = useMemo(() => {
    const colors =
      Array.isArray(product?.colors) && product.colors.length
        ? product.colors
        : variants.map(getVariantColor);

    return [...new Set(colors.filter(Boolean).map(String))];
  }, [product?.colors, variants]);

  const uniqueSizes = useMemo(() => {
    return [...new Set(getProductSizes(product).filter(Boolean).map(String))];
  }, [product]);

  const availableSizes = useMemo(() => {
    if (!selectedColor || !variants.length) return uniqueSizes;

    const matchingVariants = variants.filter((variant) =>
      sameText(getVariantColor(variant), selectedColor)
    );

    const sizes = matchingVariants
      .flatMap(getVariantSizes)
      .filter(Boolean)
      .map(String)
      .filter((size) => {
        const stockValues = matchingVariants
          .map((variant) => getVariantSizeStock(variant, size))
          .filter((stock) => stock !== null);

        return !stockValues.length || stockValues.some((stock) => stock > 0);
      });

    return sizes.length ? [...new Set(sizes)] : uniqueSizes;
  }, [selectedColor, variants, uniqueSizes]);

  const selectedVariantIndex = useMemo(() => {
    if (!variants.length) return null;

    const exactIndex = variants.findIndex((variant) => {
      const colorMatches = selectedColor
        ? sameText(getVariantColor(variant), selectedColor)
        : true;
      const sizeMatches = selectedSize
        ? getVariantSizes(variant).some((size) => sameText(size, selectedSize))
        : true;

      return colorMatches && sizeMatches;
    });

    if (exactIndex >= 0) return exactIndex;

    const index = selectedColor
      ? variants.findIndex((variant) =>
        sameText(getVariantColor(variant), selectedColor)
      )
      : 0;

    return index >= 0 ? index : null;
  }, [selectedColor, selectedSize, variants]);

  /* ---------------- DEFAULT SIZE/COLOR SELECTION ---------------- */
  useEffect(() => {
    if (!product) return;

    setSelectedColor((prev) =>
      prev && uniqueColors.includes(prev) ? prev : uniqueColors[0] || null
    );

    setSelectedSize((prev) =>
      prev && uniqueSizes.includes(prev) ? prev : uniqueSizes[0] || null
    );

    setQty(1);
    setActiveImage(0);
  }, [product, uniqueColors, uniqueSizes]);

  useEffect(() => {
    if (selectedSize && availableSizes.length && !availableSizes.includes(selectedSize)) {
      setSelectedSize(availableSizes[0] || null);
    }
  }, [availableSizes, selectedSize]);

  const allGallery = useMemo(() => {
    const items = [];
    const seen = new Set();

    const addImage = (image, meta = {}) => {
      const src = getImageValue(image);
      if (!isUsableGalleryImage(src) || seen.has(src)) return;

      seen.add(src);
      items.push({
        src,
        color: meta.color || "",
        variantIndex:
          Number.isInteger(meta.variantIndex) ? meta.variantIndex : null,
      });
    };

    addImage(product?.primaryImage);
    addImage(product?.image);
    (Array.isArray(product?.images) ? product.images : []).forEach(addImage);

    variants.forEach((variant, variantIndex) => {
      const color = getVariantColor(variant);
      [
        variant?.image,
        variant?.imageUrl,
        variant?.thumbnail,
        ...(Array.isArray(variant?.images) ? variant.images : []),
      ].forEach((image) => addImage(image, { color, variantIndex }));
    });

    return items.length
      ? items
      : [{ src: INTERNAL_FALLBACK, color: "", variantIndex: null }];
  }, [product, variants]);

  const gallery = allGallery;

  const activeGalleryItem = gallery[activeImage] || gallery[0];

  useEffect(() => {
    if (activeImage >= gallery.length) {
      setActiveImage(0);
    }
  }, [activeImage, gallery.length]);

  const handleImageSelect = (index) => {
    const item = gallery[index];
    setActiveImage(index);

    if (item?.color) {
      setSelectedColor(item.color);
    }
  };

  const handleColorSelect = (color) => {
    setSelectedColor(color);

    const colorImageIndex = allGallery.findIndex((item) =>
      sameText(item.color, color)
    );

    if (colorImageIndex >= 0) {
      setActiveImage(colorImageIndex);
    }
  };

  useEffect(() => {
    if (!selectedColor || !gallery.length) return;

    const currentItem = gallery[activeImage];
    if (currentItem?.color && sameText(currentItem.color, selectedColor)) {
      return;
    }

    const colorImageIndex = gallery.findIndex((item) =>
      sameText(item.color, selectedColor)
    );

    if (colorImageIndex >= 0) {
      setActiveImage(colorImageIndex);
    }
  }, [activeImage, gallery, selectedColor]);

  const price = safeNumber(product?.price);
  const originalPrice = safeNumber(product?.originalPrice, price);
  const discount =
    originalPrice > price && originalPrice > 0
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : 0;

  const videoUrl = getVideoUrl(product?.video);
  const isWishlisted = productId ? isInWishlist?.(productId) : false;
  const totalStock = getProductStock(product);
  const selectedStock = useMemo(() => {
    if (!selectedColor && !selectedSize) return totalStock;

    const matchedStock = variants
      .filter((variant) => {
        const colorMatches = selectedColor
          ? sameText(getVariantColor(variant), selectedColor)
          : true;
        const sizeMatches = selectedSize
          ? getVariantSizes(variant).some((size) => sameText(size, selectedSize))
          : true;
        return colorMatches && sizeMatches;
      })
      .map((variant) =>
        selectedSize
          ? getVariantSizeStock(variant, selectedSize)
          : safeNumber(variant.stock ?? variant.qty ?? variant.quantity, NaN)
      )
      .filter((stock) => stock !== null && Number.isFinite(stock));

    return matchedStock.length
      ? matchedStock.reduce((sum, stock) => sum + stock, 0)
      : totalStock;
  }, [selectedColor, selectedSize, totalStock, variants]);
  const stockState = selectedStock <= 0 ? "out" : selectedStock <= 3 ? "low" : "in";

  /* ---------------- ACTIONS ---------------- */
  const requireLogin = () => {
    if (isAuthenticated) return false;

    toast.error("Please login first");
    navigate("/login", { state: { from: location } });
    return true;
  };

  const handleAddToCart = async () => {
    if (requireLogin()) return;
    if (!productId) return toast.error("Product not found");

    const finalSize = selectedSize || uniqueSizes[0] || "";
    const finalColor = selectedColor || uniqueColors[0] || "";

    if (!finalSize && uniqueSizes.length) {
      return toast.error("Please select a size");
    }

    try {
      setLoadingAction(true);
      await addToCart(
        productId,
        qty,
        finalSize,
        null,
        null,
        finalColor,
        selectedVariantIndex ?? undefined
      );
      toast.success("Added to cart");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to add to cart");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleToggleWishlist = async () => {
    if (requireLogin()) return;
    if (!productId) return toast.error("Product not found");

    try {
      await toggleWishlist(productId);
    } catch {
      toast.error("Wishlist update failed");
    }
  };

  const handleBuyNow = () => {
    if (requireLogin()) return;
    if (!productId) return toast.error("Product not found");

    const finalSize = selectedSize || uniqueSizes[0] || "";
    const finalColor = selectedColor || uniqueColors[0] || "";

    if (!finalSize && uniqueSizes.length) {
      return toast.error("Please select a size");
    }

    navigate("/checkout", {
      state: {
        buyNowProduct: {
          ...product,
          id: productId,
          quantity: qty,
          size: finalSize,
          selectedSize: finalSize,
          color: finalColor,
          selectedColor: finalColor,
        },
      },
    });
  };

  const handleShare = async () => {
    if (!product) return;

    const url = `${window.location.origin}/product/${productId}`;
    const title = product.title || product.name || "Product";

    try {
      if (navigator.share) {
        await navigator.share({
          title,
          text: `Check out this ${title} on Doller Coach!`,
          url,
        });
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = url;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      toast.success("Link copied to clipboard!");
    } catch {
      // User may cancel native share. No toast needed.
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();

    if (requireLogin()) return;
    if (!productId) return toast.error("Product not found");

    const rating = safeNumber(newReview.rating);
    const comment = newReview.comment.trim();

    if (!rating || !comment) {
      return toast.error("Please fill all fields");
    }

    try {
      setLoadingAction(true);

      const endpoint = ENDPOINTS?.REVIEWS?.BASE || "/reviews";
      const res = await safeApi.post(endpoint, {
        productId,
        rating,
        comment,
      });

      if (res?.success === false) {
        throw new Error(res?.message || "Failed to submit review");
      }

      toast.success("Review sent for approval");
      setNewReview({ rating: 5, comment: "" });
      setShowReviewForm(false);
      refetch();
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
        err?.message ||
        "Failed to submit review"
      );
    } finally {
      setLoadingAction(false);
    }
  };

  /* ---------------- LOADING ---------------- */
  if (loading) {
    return (
      <div className="bg-white min-h-screen">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="grid lg:grid-cols-2 gap-12 animate-pulse">
            <div className="aspect-[3/4] bg-slate-100 rounded-3xl" />
            <div className="space-y-6">
              <div className="h-4 w-24 bg-slate-100 rounded" />
              <div className="h-10 w-3/4 bg-slate-100 rounded" />
              <div className="h-8 w-32 bg-slate-100 rounded" />
              <div className="space-y-4 pt-8">
                <div className="h-12 w-full bg-slate-100 rounded-xl" />
                <div className="h-12 w-full bg-slate-100 rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- ERROR ---------------- */
  if (error || (!product && !loading)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
        <h2 className="text-xl font-semibold mb-3">
          {error || "Product not found"}
        </h2>

        <div className="space-y-4">
          <button
            type="button"
            onClick={refetch}
            className="px-8 py-3 bg-black text-white rounded-xl font-bold uppercase tracking-widest text-[10px] mr-4"
          >
            Try Again
          </button>

          <button
            type="button"
            onClick={() => navigate("/collection")}
            className="px-8 py-3 bg-slate-100 text-black rounded-xl font-bold uppercase tracking-widest text-[10px]"
          >
            Back to Shop
          </button>
        </div>
      </div>
    );
  }

  /* ---------------- PRODUCT NOT ACTIVE ---------------- */
  if (product && product.status && product.status !== "active") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
        <h2 className="text-xl font-semibold mb-3">Product not available</h2>

        <button
          type="button"
          onClick={() => navigate("/collection")}
          className="px-8 py-3 bg-black text-white rounded-xl font-bold uppercase tracking-widest text-[10px]"
        >
          Back to shop
        </button>
      </div>
    );
  }

  /* ---------------- UI ---------------- */
  return (
    <div className="bg-white min-h-screen pb-10">
      <div className="max-w-6xl mx-auto px-4 py-3">
        <div className="grid lg:grid-cols-[minmax(320px,0.9fr)_minmax(360px,1fr)] gap-6 items-start">
          <div className="w-full max-w-[420px] mx-auto lg:mx-0">
            <div className="relative aspect-[3/4] max-h-[calc(100vh-190px)] bg-slate-50 rounded-[1.75rem] overflow-hidden shadow-xl group">
              <SafeImage
                key={`${productId}-${activeGalleryItem?.src || ""}`}
                src={activeGalleryItem?.src}
                alt={product.title || product.name || "Product"}
                wrapperClassName="w-full h-full"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                priority
              />

              {videoUrl && (
                <button
                  type="button"
                  onClick={() => setShowVideoModal(true)}
                  className="absolute bottom-8 left-8 flex items-center gap-3 bg-white/90 backdrop-blur-xl px-6 py-4 rounded-2xl shadow-2xl hover:bg-black hover:text-white transition-all group/v"
                >
                  <div className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-900 text-white group-hover/v:bg-white group-hover/v:text-black">
                    <Play size={16} fill="currentColor" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black uppercase tracking-widest leading-none">
                      Watch Preview
                    </p>
                    <p className="text-[8px] font-bold opacity-60 uppercase tracking-tighter mt-1">
                      Cinematic Experience
                    </p>
                  </div>
                </button>
              )}
            </div>

            <div className="flex gap-3 mt-4 overflow-x-auto pb-2 scrollbar-hide">
              {gallery.map((item, index) => (
                <button
                  key={`${item.src}-${index}`}
                  type="button"
                  onClick={() => handleImageSelect(index)}
                  className={`flex-shrink-0 w-14 md:w-16 aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all ${activeImage === index
                      ? "border-black scale-95 shadow-lg"
                      : "border-transparent opacity-60"
                    }`}
                >
                  <SafeImage
                    src={item.src}
                    alt="thumb"
                    wrapperClassName="w-full h-full"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4 lg:sticky lg:top-24">
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 hover:text-black transition-colors"
              >
                <ArrowLeft size={14} /> Back to Collection
              </button>

              <div className="flex justify-between items-start gap-4">
                <div>
                  <h1 className="text-2xl md:text-3xl xl:text-4xl font-black uppercase tracking-tighter leading-none">
                    {product.title || product.name || "Product"}
                  </h1>
                </div>

                <button
                  type="button"
                  onClick={handleShare}
                  className="p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors"
                  title="Share"
                >
                  <Share2 size={20} />
                </button>
              </div>

              {product?.offer?.isActive && product?.offer?.title && (
                <div className="bg-gradient-to-br from-red-500 to-rose-600 text-white p-5 rounded-[2rem] shadow-xl shadow-red-500/20 space-y-4 animate-in fade-in slide-in-from-bottom-4 border border-white/10 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 bg-white/10 rounded-full blur-3xl" />

                  <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1">
                      <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight flex items-center gap-2">
                        <span>{product.offer.title}</span>
                        {product.offer.discount && (
                          <span className="bg-white text-red-600 px-2 py-0.5 rounded-lg text-sm shadow-sm">
                            {product.offer.discount}
                          </span>
                        )}
                      </h2>

                      {product.offer.couponCode && (
                        <p className="inline-flex items-center gap-2 bg-black/20 border border-black/10 text-white px-3 py-1.5 rounded-xl text-[10px] font-bold tracking-widest uppercase">
                          Use Code:{" "}
                          <span className="font-black text-white text-xs">
                            {product.offer.couponCode}
                          </span>
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-start md:items-end gap-2 w-full md:w-auto">
                      {product.offer.expiryDate && (
                        <Countdown expiry={product.offer.expiryDate} />
                      )}

                      {product.offer.startDate && product.offer.expiryDate && (
                        <p className="text-[8px] font-bold opacity-75 uppercase tracking-widest">
                          Valid: {safeDate(product.offer.startDate)}
                          {" - "}
                          {safeDate(product.offer.expiryDate)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div
                className="flex items-center gap-3 cursor-pointer group"
                onClick={() =>
                  reviewsRef.current?.scrollIntoView({ behavior: "smooth" })
                }
              >
                <StarRating rating={avgRating} />

                <span className="text-xs font-bold text-slate-500 underline decoration-slate-200 group-hover:text-black group-hover:decoration-black transition-all">
                  {totalReviews === 0
                    ? "No ratings yet"
                    : `${avgRating} / 5 (${totalReviews} Verified Reviews)`}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Current Price
                </p>
                <span className="text-3xl font-black tracking-tighter">
                  {formatPrice(price)}
                </span>
              </div>

              {discount > 0 && (
                <div className="flex flex-col gap-1 border-l border-slate-200 pl-4">
                  <span className="line-through text-slate-400 font-bold text-sm">
                    {formatPrice(originalPrice)}
                  </span>
                  <span className="text-green-600 text-xs font-black bg-green-50 px-2 py-1 rounded-md">
                    SAVE {discount}%
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {uniqueColors.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Select Color
                  </p>

                  <div className="flex gap-3">
                    {uniqueColors.map((color) => {
                      const variant = variants.find(
                        (item) => getVariantColor(item) === color
                      );
                      const hex = variant?.colorCode || color;

                      return (
                        <button
                          key={color}
                          type="button"
                          onClick={() => handleColorSelect(color)}
                          className={`group relative w-9 h-9 rounded-full border-2 transition-all p-0.5 ${selectedColor === color
                              ? "border-black shadow-lg scale-110"
                              : "border-transparent"
                            }`}
                          title={color}
                        >
                          <div
                            className="w-full h-full rounded-full shadow-inner flex items-center justify-center bg-slate-200"
                            style={{ backgroundColor: hex }}
                          >
                            {!String(hex).startsWith("#") && hex !== color && (
                              <span className="text-[10px] text-slate-400">
                                {String(color).charAt(0)}
                              </span>
                            )}
                          </div>

                          {selectedColor === color && (
                            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[8px] font-black uppercase tracking-tighter whitespace-nowrap">
                              {color}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {uniqueSizes.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Select Size
                    </p>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {uniqueSizes.map((size) => {
                      const isAvailable = availableSizes.includes(size);

                      return (
                        <button
                          key={size}
                          type="button"
                          disabled={!isAvailable}
                          onClick={() => setSelectedSize(size)}
                          className={`h-10 min-w-[2.5rem] px-4 rounded-lg text-xs font-black transition-all border-2 ${selectedSize === size
                              ? "bg-black text-white border-black shadow-lg shadow-black/20"
                              : isAvailable
                                ? "bg-white border-slate-100 hover:border-black"
                                : "bg-slate-50 border-transparent text-slate-300 cursor-not-allowed"
                            }`}
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-widest ${
                  stockState === "out"
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : stockState === "low"
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                {stockState === "in" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                <span>
                  {stockState === "out"
                    ? "Out of stock"
                    : stockState === "low"
                      ? `Only ${selectedStock} left`
                      : `In stock (${selectedStock})`}
                </span>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                  <button
                    type="button"
                    onClick={() => setQty((prev) => Math.max(1, prev - 1))}
                    className="p-1 hover:text-black transition-colors"
                  >
                    <Minus size={16} />
                  </button>

                  <span className="w-8 text-center font-black text-sm">
                    {qty}
                  </span>

                  <button
                    type="button"
                    onClick={() => setQty((prev) => Math.min(10, prev + 1))}
                    className="p-1 hover:text-black transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Max 10 per order
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={loadingAction || stockState === "out"}
                  className="flex-1 h-12 bg-white border-2 border-slate-100 rounded-xl flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-[0.2em] transition-all hover:border-black disabled:opacity-50"
                >
                  <ShoppingCart size={18} /> Add to Cart
                </button>

                <button
                  type="button"
                  onClick={handleBuyNow}
                  disabled={loadingAction || stockState === "out"}
                  className="flex-1 h-12 bg-black text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all hover:bg-slate-800 shadow-xl shadow-black/20 disabled:opacity-50"
                >
                  Buy Instantly
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4">
              <div className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
                  <Truck size={14} className="text-slate-600" />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest">
                    Free Delivery
                  </p>
                  <p className="text-[8px] font-bold text-slate-400 mt-0.5">
                    Orders above ₹999
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
                  <Heart size={14} className="text-slate-600" />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest">
                    Add to Favs
                  </p>
                  <button
                    type="button"
                    onClick={handleToggleWishlist}
                    className="text-[8px] font-bold text-slate-400 mt-0.5 underline decoration-slate-200"
                  >
                    {isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div ref={reviewsRef} className="mt-12 border-t border-slate-100 pt-10">
          <div className="space-y-8">
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-black uppercase tracking-tighter">
                  Verified Reviews
                </h2>

                <div className="flex items-center gap-2">
                  <div className="px-4 py-2 bg-slate-50 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-500">
                    {reviews.length} Stories Shared
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowReviewForm(true)}
                    className="px-4 py-2 bg-black text-white rounded-full text-[10px] font-black uppercase tracking-widest"
                  >
                    Review
                  </button>
                </div>
              </div>

              {reviews.length > 0 ? (
                <div className="grid gap-8">
                  {reviews.map((review, index) => {
                    const reviewRating = safeNumber(review?.rating);

                    return (
                      <div
                        key={review?._id || review?.id || `review-${index}`}
                        className="group p-8 bg-slate-50 rounded-[2rem] border border-transparent hover:border-slate-200 hover:bg-white transition-all duration-300"
                      >
                        <div className="flex justify-between items-start mb-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center font-black text-xs">
                              {review?.user?.name?.charAt(0) || "U"}
                            </div>
                            <div>
                              <p className="font-black text-xs uppercase tracking-widest">
                                {review?.user?.name || "Guest User"}
                              </p>
                              <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                                Verified Purchase
                              </p>
                            </div>
                          </div>

                          <div className="flex text-yellow-500 gap-1 bg-white px-3 py-1.5 rounded-full shadow-sm">
                            {[1, 2, 3, 4, 5].map((item) => (
                              <Star
                                key={item}
                                size={10}
                                fill={item <= reviewRating ? "currentColor" : "none"}
                              />
                            ))}
                          </div>
                        </div>

                        <p className="text-slate-600 text-sm leading-relaxed font-medium">
                          "{review?.comment || review?.text || ""}"
                        </p>

                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em] pt-6 flex items-center gap-2">
                          <span className="w-4 h-[1px] bg-slate-200" />
                          {safeDate(review?.createdAt)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-20 text-center bg-slate-50 rounded-[3rem] border border-dashed border-slate-200">
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                    No reviews yet
                  </p>
                </div>
              )}
            </div>

            <div className={`${showReviewForm ? "fixed inset-0 z-[1000] bg-black/50 backdrop-blur-sm flex items-center justify-center px-4" : "hidden"}`}>
            <div className="relative w-full max-w-md bg-slate-900 text-white p-8 rounded-[2rem] shadow-2xl">
              <button
                type="button"
                onClick={() => setShowReviewForm(false)}
                className="absolute right-4 top-4 h-9 w-9 rounded-full bg-white/10 text-white hover:bg-white hover:text-black"
              >
                ×
              </button>
              <h3 className="text-xl font-black uppercase tracking-widest mb-2">
                Write a Review
              </h3>

              <p className="text-slate-400 text-xs font-bold leading-relaxed mb-8">
                Share your experience with the community.
              </p>

              <form onSubmit={handleReviewSubmit} className="space-y-6">
                <div className="space-y-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                    Your Rating
                  </p>

                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() =>
                          setNewReview((prev) => ({ ...prev, rating: num }))
                        }
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${newReview.rating >= num
                            ? "bg-yellow-500 text-white shadow-lg shadow-yellow-500/20"
                            : "bg-white/10 text-white/40 hover:bg-white/20"
                          }`}
                      >
                        <Star
                          size={14}
                          fill={newReview.rating >= num ? "currentColor" : "none"}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                    Your Thoughts
                  </p>

                  <textarea
                    value={newReview.comment}
                    onChange={(e) =>
                      setNewReview((prev) => ({
                        ...prev,
                        comment: e.target.value,
                      }))
                    }
                    placeholder="What did you like about this product?"
                    className="w-full bg-white/10 border border-white/5 rounded-2xl p-5 text-sm font-medium outline-none focus:border-white/20 h-32 resize-none placeholder:text-white/20"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loadingAction}
                  className="w-full h-14 bg-white text-black font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl hover:bg-slate-100 transition-all disabled:opacity-50"
                >
                  Submit for Approval
                </button>

                <p className="text-[8px] text-center text-slate-500 font-bold uppercase tracking-widest">
                  Reviews are audited before going live
                </p>
              </form>
            </div>
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <div className="mt-16 border-t border-slate-100 pt-10">
            <div className="flex justify-between items-end mb-6">
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                  Complete the Look
                </p>
                <h2 className="text-4xl font-black uppercase tracking-tighter">
                  You May Also Like
                </h2>
              </div>

              <button
                type="button"
                onClick={() => navigate("/collection")}
                className="hidden md:block text-[10px] font-black uppercase tracking-widest border-b-2 border-black pb-1 hover:opacity-60 transition-all"
              >
                Explore Full Collection
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {related.map((item, index) => (
                <ProductCard
                  key={item.id || item._id || `related-${index}`}
                  product={item}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <VideoModal
        isOpen={showVideoModal}
        onClose={() => setShowVideoModal(false)}
        videoUrl={videoUrl}
      />
    </div>
  );
}
