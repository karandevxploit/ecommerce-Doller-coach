import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuthStore, useCartStore } from "../store";
import { ArrowLeft, Heart, Star, ShoppingCart, ShieldCheck, Send, MessageSquare, Zap, ArrowRight, X } from "lucide-react";
import { LuShare2 } from "react-icons/lu";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { formatPrice } from "../utils/format";
import ProductCard from "../components/ProductCard";
import FloatingVideo from "../components/FloatingVideo";
import { mapProduct, mapReview } from "../api/dynamicMapper";
import SEO from "../components/SEO";

export default function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { addToCart } = useCartStore();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeImage, setActiveImage] = useState("");

  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedTopSize, setSelectedTopSize] = useState(null);
  const [selectedBottomSize, setSelectedBottomSize] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [related, setRelated] = useState([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [reviews, setReviews] = useState([]);
  useEffect(() => {
    const load = async () => {
      try {
        if (!id || id === "undefined") {
          setError("Product Reference Missing");
          setLoading(false);
          return;
        }
        setLoading(true);
        const res = await api.get(`/products/${id}`);
        const mapped = mapProduct(res?.data || res);
        setProduct(mapped);
        setActiveImage(mapped?.image);

        if (mapped.type === "FULL_OUTFIT") {
          if (mapped.topSizes?.length > 0) setSelectedTopSize(mapped.topSizes[0]);
          if (mapped.bottomSizes?.length > 0) setSelectedBottomSize(mapped.bottomSizes[0]);
        } else {
          if (mapped.sizes?.length > 0) setSelectedSize(mapped.sizes[0]);
        }

        try {
          setLoadingRelated(true);
          const relRes = await api.get(`/products?category=${mapped.category}&limit=6`);
          const relData = relRes?.data || relRes?.items || (Array.isArray(relRes) ? relRes : []);
          setRelated(relData.map(mapProduct).filter((p) => (p._id || p.id) !== id));
        } catch (err) {
          setRelated([]);
        }
      } catch (err) {
        toast.error("Error loading: Product Details");
        setError("Synchronization failure");
      } finally {
        setLoading(false);
        setLoadingRelated(false);
      }
    };

    const checkReview = async () => {
      if (!isAuthenticated || !id || id === "undefined") return;
      try {
        const data = await api.get(`/orders/check-review/${id}`);
        setCanReview(data.canReview);
      } catch (err) {
        setCanReview(false);
      }
    };

    load();
    checkReview();
    window.scrollTo(0, 0);
  }, [id, isAuthenticated]);

  const loadReviews = async () => {
    if (!id) return;
    try {
      const data = await api.get(`/reviews/${id}`);
      setReviews(Array.isArray(data) ? data.map(mapReview) : []);
    } catch (err) {
      setReviews([]);
    }
  };

  useEffect(() => {
    if (id) {
      loadReviews();
    }
  }, [id]);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.title,
          text: product.description,
          url,
        });
      } catch (err) {
        if (err.name !== "AbortError") toast.error("Share failed");
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard!");
    }
  };

  const onAddToCart = () => {
    if (!product || product.stock <= 0) return toast.error("Product Out of Stock");

    if (product.type === "FULL_OUTFIT") {
      if (!selectedTopSize || !selectedBottomSize) return toast.error("Please select both Top and Bottom sizes");
      addToCart(product._id || product.id, 1, null, selectedTopSize, selectedBottomSize);
    } else {
      if (product.sizes?.length > 0 && !selectedSize) return toast.error("Please select a size");
      addToCart(product._id || product.id, 1, selectedSize);
    }
    toast.success("System Added to Bag");
  };

  const onBuyNow = () => {
    if (!isAuthenticated) return navigate("/login");
    if (!product || product.stock <= 0) return toast.error("Product Out of Stock");

    let buyNowPayload = { ...product, quantity: 1 };
    if (product.type === "FULL_OUTFIT") {
      if (!selectedTopSize || !selectedBottomSize) return toast.error("Please select both Top and Bottom sizes");
      buyNowPayload = { ...buyNowPayload, topSize: selectedTopSize, bottomSize: selectedBottomSize };
    } else {
      if (product.sizes?.length > 0 && !selectedSize) return toast.error("Please select a size");
      buyNowPayload = { ...buyNowPayload, size: selectedSize };
    }

    navigate("/checkout", { state: { buyNowProduct: buyNowPayload } });
  };

  const submitReview = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) return navigate("/login");
    if (!reviewForm.comment.trim()) return toast.error("Review comment required");
    if (!reviewForm.rating) return toast.error("Rating required");

    setSubmittingReview(true);
    try {
      await api.post("/reviews", {
        productId: id,
        rating: reviewForm.rating,
        comment: reviewForm.comment.trim()
      });
      toast.success("Review submitted successfully");
      setReviewForm({ rating: 5, comment: "" });
      setIsReviewOpen(false);
      loadReviews();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Submit failure");
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleWishlist = async () => {
    if (!isAuthenticated) return navigate("/login");
    try {
      await api.post("/wishlist", { productId: product._id || product.id });
      toast.success("Iduser Saved");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Save failure");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="h-12 w-12 border-4 border-gray-50 border-t-[#1e3a8a] animate-spin rounded-full shadow-lg" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="text-center py-48 space-y-6 bg-white min-h-screen relative overflow-hidden">
        <h2 className="text-2xl font-bold text-[#0f172a] uppercase">Error Occurred: {error || "Product Missing"}</h2>
        <button onClick={() => navigate("/collection")} className="px-4 py-2 text-sm rounded-lg bg-[#0f172a] text-white hover:bg-gray-800 transition-all">
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      <SEO 
        title={product.title}
        description={product.description}
        image={activeImage}
        price={product.price}
        type="product"
      />
      <div className="max-w-6xl mx-auto px-4 py-8">

        <button
          onClick={() => navigate(-1)}
          className="mb-8 flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-gray-900 transition-colors group"
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

          <div className="w-full">
            <div className="space-y-4">
              <img
                src={activeImage || "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=436&auto=format&fit=crop"}
                className="w-full max-w-md rounded-xl object-cover shadow-sm border border-gray-100"
                alt={product?.title}
              />
              {product.images?.length > 1 && (
                <div className="flex gap-2 flex-wrap">
                  {product.images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImage(img)}
                      className={`h-16 w-14 rounded-lg overflow-hidden border-2 transition-all ${activeImage === img ? "border-indigo-600" : "border-gray-100 opacity-60"}`}
                    >
                      <img src={img} className="w-full h-full object-cover" alt="" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="w-full max-w-md space-y-4 text-left">
            <div className="space-y-1">
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                  {product.category || "Apparel"}
                </span>
                <button
                  onClick={handleShare}
                  className="p-2 rounded-full border border-gray-100 text-gray-400 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50 transition-all shadow-sm"
                  title="Share"
                >
                  <LuShare2 size={16} />
                </button>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">
                {product.title}
              </h1>
              <div className="text-xl font-bold text-gray-800">
                {formatPrice(product.price)}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5 text-yellow-400">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} size={14} fill={(product.rating || 0) >= s ? "currentColor" : "none"} strokeWidth={2} className={(product.rating || 0) >= s ? "text-yellow-400" : "text-gray-200"} />
                  ))}
                </div>
                <span className="text-xs font-bold text-gray-500">
                  ({product.rating?.toFixed(1) || "0.0"})
                </span>
              </div>

              <button
                onClick={() => setIsReviewOpen(true)}
                className="text-[10px] font-black uppercase tracking-[0.1em] text-indigo-600 hover:text-indigo-700 underline underline-offset-4"
              >
                Write Review
              </button>
            </div>

            <p className="text-sm text-gray-500 leading-relaxed">
              {product.description || "Premium apparel engineered for aesthetic precision."}
            </p>

            <div className="space-y-6 pt-4">
              {product.type === "FULL_OUTFIT" ? (
                <div className="space-y-8">
                  {/* TOP SIZE SELECTION */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Select Top Size</p>
                      <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest">Available: {product.topSizes?.length || 0}</span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {["S", "M", "L", "XL", "XXL"].map(size => {
                        const isAvailable = product.topSizes?.includes(size);
                        const isSelected = selectedTopSize === size;
                        return (
                          <button
                            key={size}
                            disabled={!isAvailable}
                            onClick={() => setSelectedTopSize(size)}
                            className={`h-11 min-w-[3rem] px-4 rounded-xl border text-[11px] font-black tracking-widest transition-all
                              ${!isAvailable
                                ? "opacity-20 cursor-not-allowed bg-gray-50 border-gray-100 text-gray-400"
                                : isSelected
                                  ? "bg-[#0f172a] border-[#0f172a] text-white shadow-xl scale-105"
                                  : "bg-white border-gray-100 text-[#0f172a] hover:border-[#1e3a8a] active:scale-95"
                              }`}
                          >
                            {size}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* BOTTOM SIZE SELECTION */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Select Bottom Size</p>
                      <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest">Available: {product.bottomSizes?.length || 0}</span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {["28", "30", "32", "34", "36", "38"].map(size => {
                        const isAvailable = product.bottomSizes?.includes(size);
                        const isSelected = selectedBottomSize === size;
                        return (
                          <button
                            key={size}
                            disabled={!isAvailable}
                            onClick={() => setSelectedBottomSize(size)}
                            className={`h-11 min-w-[3rem] px-4 rounded-xl border text-[11px] font-black tracking-widest transition-all
                              ${!isAvailable
                                ? "opacity-20 cursor-not-allowed bg-gray-50 border-gray-100 text-gray-400"
                                : isSelected
                                  ? "bg-[#0f172a] border-[#0f172a] text-white shadow-xl scale-105"
                                  : "bg-white border-gray-100 text-[#0f172a] hover:border-[#1e3a8a] active:scale-95"
                              }`}
                          >
                            {size}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Select Size</p>
                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest px-2 py-0.5 bg-indigo-50 rounded-md">
                      {product.type || "STANDARD"}
                    </span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {(product.type === "BOTTOMWEAR"
                      ? ["28", "30", "32", "34", "36", "38"]
                      : ["S", "M", "L", "XL", "XXL"]
                    ).map(size => {
                      const isAvailable = product.sizes?.includes(size);
                      const isSelected = selectedSize === size;
                      return (
                        <button
                          key={size}
                          disabled={!isAvailable}
                          onClick={() => setSelectedSize(size)}
                          className={`h-12 min-w-[3rem] px-4 rounded-xl border text-[11px] font-black tracking-widest transition-all
                            ${!isAvailable
                              ? "opacity-20 cursor-not-allowed bg-gray-50 border-gray-100 text-gray-400"
                              : isSelected
                                ? "bg-[#0f172a] border-[#0f172a] text-white shadow-xl scale-105"
                                : "bg-white border-gray-100 text-[#0f172a] hover:border-[#0f172a] hover:bg-gray-50 active:scale-95"
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

            <div className="space-y-3 pt-4 border-t border-gray-100">
              <button
                onClick={onBuyNow}
                className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-bold text-sm tracking-wide shadow-sm hover:bg-indigo-700 transition active:scale-[0.98] flex items-center justify-center gap-2"
              >
                BUY NOW <Zap size={16} />
              </button>

              <div className="flex gap-2">
                <button
                  onClick={onAddToCart}
                  className="flex-1 border border-gray-200 py-2.5 rounded-lg text-sm font-bold text-gray-800 hover:bg-gray-50 transition active:scale-[0.98]"
                >
                  ADD TO BAG
                </button>
                <button
                  onClick={handleWishlist}
                  className="px-4 border border-gray-200 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition flex items-center justify-center active:scale-[0.95]"
                >
                  <Heart size={20} />
                </button>
              </div>
            </div>

            <div className="pt-8 border-t border-gray-100 space-y-4">
              <h2 className="text-lg font-bold text-gray-900">Reviews</h2>
              <div className="space-y-4">
                {(!reviews || reviews.length === 0) ? (
                  <p className="text-sm text-gray-400 italic">Be the first to review</p>
                ) : (
                  reviews.slice(0, 3).map((rev) => (
                    <div key={rev.id} className="bg-gray-50/50 rounded-xl p-4 border border-gray-100">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-bold text-gray-900">{rev.user}</span>
                        <div className="flex gap-0.5 text-xs text-yellow-400">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star key={s} size={12} fill={rev.rating >= s ? "currentColor" : "none"} className={rev.rating >= s ? "" : "text-gray-200"} strokeWidth={2} />
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 font-medium">"{rev.comment}"</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Review Modal */}
        <AnimatePresence>
          {isReviewOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsReviewOpen(false)}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl relative z-10 overflow-hidden"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-gray-900">Post Review</h3>
                  <button onClick={() => setIsReviewOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <X size={20} className="text-gray-400" />
                  </button>
                </div>

                <form onSubmit={submitReview} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Rating</label>
                    <div className="flex gap-1.5 text-yellow-400 bg-gray-50 p-3 rounded-2xl border border-gray-100 w-fit">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setReviewForm(prev => ({ ...prev, rating: star }))}
                          className="focus:outline-none transition-transform active:scale-90"
                        >
                          <Star size={24} fill={reviewForm.rating >= star ? "currentColor" : "none"} className={reviewForm.rating >= star ? "text-yellow-400" : "text-gray-200"} strokeWidth={2} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Comments</label>
                    <textarea
                      value={reviewForm.comment}
                      onChange={(e) => setReviewForm(prev => ({ ...prev, comment: e.target.value }))}
                      placeholder="What's your experience?"
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none transition-all"
                      rows={4}
                    />
                  </div>

                  <button
                    disabled={submittingReview}
                    className="w-full bg-indigo-600 text-white h-12 rounded-2xl text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition active:scale-[0.98] disabled:opacity-50"
                  >
                    {submittingReview ? "Submitting..." : "Submit Review"}
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <section className="mt-16 pt-8 border-t border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-6">You may also like</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {loadingRelated ? (
              [1, 2, 3, 4].map((s) => (
                <div key={s} className="aspect-[3/4] bg-gray-50 rounded-xl animate-pulse" />
              ))
            ) : (
              related.slice(0, 4).map((p) => (
                <ProductCard key={p._id || p.id} product={p} />
              ))
            )}
          </div>
        </section>
      </div>
      {product.video && <FloatingVideo videoUrl={product.video} />}
    </div>
  );
}