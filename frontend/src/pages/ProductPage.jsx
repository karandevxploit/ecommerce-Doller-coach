import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { api } from "../api/client";
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
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuthStore, useCartStore, useWishlistStore } from "../store";
import { formatPrice } from "../utils/format";
import { mapProduct } from "../api/dynamicMapper";
import SafeImage from "../components/ui/SafeImage";
import ProductCard from "../components/ProductCard";
import VideoModal from "../components/common/VideoModal";
import { Play } from "lucide-react";

export default function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const { isAuthenticated } = useAuthStore();
  const { addToCart } = useCartStore();
  const { toggleWishlist, isInWishlist } = useWishlistStore();

  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);

  const [loading, setLoading] = useState(true);

  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [activeImage, setActiveImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, comment: "" });
  
  const reviewsRef = useRef(null);
  const hasFetched = useRef(false);

  /* ---------------- FETCH ---------------- */
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      // Singleton check for React Strict Mode and rapid navigation
      if (hasFetched.current && product?.id === id) return;
      hasFetched.current = true;

      try {
        setLoading(true);

        const res = await api.get(ENDPOINTS.PRODUCTS.GET(id));
        const rawProduct = res.data?.data || res.data || res;
        const mapped = mapProduct(rawProduct);

        if (!mounted) return;
        setProduct(mapped);

        // Parallel Optimization: Fetch secondary data (reviews/related) simultaneously
        const [revRes, relRes] = await Promise.all([
          api.get(ENDPOINTS.REVIEWS.BY_PRODUCT(id)),
          api.get(`${ENDPOINTS.PRODUCTS.LIST}?category=${mapped.category?.main || ""}&limit=8`)
        ]);

        if (!mounted) return;

        // 1. Safe Reviews Extraction
        const reviewsData = Array.isArray(revRes?.data?.data) ? revRes.data.data :
                           Array.isArray(revRes?.data) ? revRes.data : [];
        setReviews(reviewsData);

        // 2. Safe Related Products Extraction
        console.log(">>> [DEBUG] Related Response Data:", relRes?.data);

        // 🛡️ Safe Array Extraction
        const rawRelated = 
          Array.isArray(relRes?.data?.products) ? relRes.data.products :
          Array.isArray(relRes?.data?.data) ? relRes.data.data :
          Array.isArray(relRes?.data) ? relRes.data : 
          [];

        const relData = rawRelated.map(mapProduct).filter(Boolean);
        setRelated(relData.filter((p) => p.id !== id));

      } catch (err) {
        console.error("[PRODUCT_PAGE_ERR]", err);
        toast.error("Failed to load product");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    window.scrollTo(0, 0);

    return () => {
      mounted = false;
      hasFetched.current = false;
    };
  }, [id]);

  /* ---------------- DEFAULT SIZE ---------------- */
  useEffect(() => {
    if (product?.variants?.length && !selectedColor) {
      setSelectedColor(product.variants[0].color);
    }
    if (product?.sizes?.length) {
      setSelectedSize(product.sizes[0]);
    }
  }, [product]);

  const gallery = useMemo(() => {
    const imgs = product?.images || [];
    if (imgs.length > 0) return imgs;
    return product?.image ? [product.image] : ["/placeholder.png"];
  }, [product]);

  const price = product?.price || 0;
  const originalPrice = product?.originalPrice || price;
  const discount = originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;

  /* ---------------- ACTIONS ---------------- */
  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      toast.error("Please login first");
      return navigate("/login", { state: { from: location } });
    }
    if (!product?.id) return toast.error("Product ID missing");
    if (!selectedSize && product?.sizes?.length) return toast.error("Please select a size");
    try {
      setLoadingAction(true);
      await addToCart(product.id, qty, selectedSize, null, null, selectedColor);
      toast.success("Added to cart");
    } catch (err) {
      toast.error("Failed to add to cart");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleToggleWishlist = async () => {
    if (!isAuthenticated) {
      toast.error("Please login first");
      return navigate("/login", { state: { from: location } });
    }
    await toggleWishlist(product.id);
  };

  const handleBuyNow = () => {
    if (!isAuthenticated) return navigate("/login", { state: { from: location } });
    if (!selectedSize && product?.sizes?.length) return toast.error("Please select a size");
    navigate("/checkout", { state: { buyNowProduct: { ...product, quantity: qty, selectedSize } } });
  };

  const handleShare = () => {
    const shareData = { title: product.title, text: `Check out this ${product.title} on Doller Coach!`, url: window.location.href };
    if (navigator.share) navigator.share(shareData).catch(() => {});
    else { navigator.clipboard.writeText(window.location.href); toast.success("Link copied to clipboard!"); }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) return navigate("/login", { state: { from: location } });
    if (!newReview.rating || !newReview.comment.trim()) return toast.error("Please fill all fields");
    try {
      setLoadingAction(true);
      await api.post(ENDPOINTS.REVIEWS.BASE, { productId: id, rating: newReview.rating, comment: newReview.comment });
      toast.success("Review sent for approval");
      setNewReview({ rating: 5, comment: "" });
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit review");
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
  if (!product || (product.status !== 'active' && !loading)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
        <h2 className="text-xl font-semibold mb-3">
          {product?.status && product.status !== 'active' ? "Product not available" : "Product not found"}
        </h2>
        <button onClick={() => navigate("/collection")} className="px-8 py-3 bg-black text-white rounded-xl font-bold uppercase tracking-widest text-[10px]">
          Back to shop
        </button>
      </div>
    );
  }

  /* ---------------- UI ---------------- */
  return (
    <div className="bg-white min-h-screen pb-20">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <div className="w-full max-w-[480px] mx-auto lg:mx-0">
            <div className="relative aspect-[3/4] bg-slate-50 rounded-[2.5rem] overflow-hidden shadow-2xl group">
              <SafeImage
                src={gallery[activeImage]}
                alt={product.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              {product.video && (
                <button onClick={() => setShowVideoModal(true)} className="absolute bottom-8 left-8 flex items-center gap-3 bg-white/90 backdrop-blur-xl px-6 py-4 rounded-2xl shadow-2xl hover:bg-black hover:text-white transition-all group/v">
                  <div className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-900 text-white group-hover/v:bg-white group-hover/v:text-black"><Play size={16} fill="currentColor" /></div>
                  <div className="text-left">
                     <p className="text-[10px] font-black uppercase tracking-widest leading-none">Watch Preview</p>
                     <p className="text-[8px] font-bold opacity-60 uppercase tracking-tighter mt-1">Cinematic Experience</p>
                  </div>
                </button>
              )}
            </div>
            <div className="flex gap-4 mt-6 overflow-x-auto pb-2 scrollbar-hide">
              {gallery.map((img, i) => (
                <button key={i} onClick={() => setActiveImage(i)} className={`flex-shrink-0 w-20 aspect-[3/4] rounded-2xl overflow-hidden border-2 transition-all ${activeImage === i ? "border-black scale-95 shadow-lg" : "border-transparent opacity-60"}`}>
                  <SafeImage src={img} alt="thumb" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-8 lg:sticky lg:top-28">
            <div className="space-y-4">
              <button onClick={() => navigate(-1)} className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 hover:text-black transition-colors">
                <ArrowLeft size={14} /> Back to Collection
              </button>
              <div className="flex justify-between items-start gap-4">
                <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter leading-none">{product.title}</h1>
                <button onClick={handleShare} className="p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors" title="Share"><Share2 size={20} /></button>
              </div>
              <div className="flex items-center gap-3 cursor-pointer group" onClick={() => reviewsRef.current?.scrollIntoView({ behavior: 'smooth' })}>
                <div className="flex text-yellow-500 gap-0.5">
                  {[...Array(5)].map((_, i) => <Star key={i} size={16} fill={i < Math.floor(product.ratings?.average || 5) ? "currentColor" : "none"} />)}
                </div>
                <span className="text-xs font-bold text-slate-500 underline decoration-slate-200 group-hover:text-black group-hover:decoration-black transition-all">{reviews.length} Verified Reviews</span>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Current Price</p>
                <span className="text-4xl font-black tracking-tighter">{formatPrice(price)}</span>
              </div>
              {discount > 0 && (
                <div className="flex flex-col gap-1 border-l border-slate-200 pl-4">
                  <span className="line-through text-slate-400 font-bold text-sm">{formatPrice(originalPrice)}</span>
                  <span className="text-green-600 text-xs font-black bg-green-50 px-2 py-1 rounded-md">SAVE {discount}%</span>
                </div>
              )}
            </div>

            <div className="space-y-6">
              {product.variants?.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Select Color</p>
                  <div className="flex gap-4">
                    {[...new Set(product.variants.map(v => v.color))].map((c) => (
                      <button key={c} onClick={() => setSelectedColor(c)} className={`group relative w-10 h-10 rounded-full border-2 transition-all p-0.5 ${selectedColor === c ? 'border-black scale-110' : 'border-transparent'}`} title={c}>
                        <div className="w-full h-full rounded-full shadow-inner" style={{ backgroundColor: product.variants.find(v => v.color === c)?.colorCode || c }} />
                        {selectedColor === c && <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[8px] font-black uppercase tracking-tighter whitespace-nowrap">{c}</div>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {product.sizes?.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Select Size</p>
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    {product.sizes.map((s) => (
                      <button key={s} onClick={() => setSelectedSize(s)} className={`h-12 min-w-[3rem] px-5 rounded-xl text-xs font-black transition-all border-2 ${selectedSize === s ? "bg-black text-white border-black shadow-lg shadow-black/20" : "bg-white border-slate-100 hover:border-black"}`}>{s}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4 pt-4">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                  <button onClick={() => setQty(Math.max(1, qty - 1))} className="p-1 hover:text-black transition-colors"><Minus size={16} /></button>
                  <span className="w-8 text-center font-black text-sm">{qty}</span>
                  <button onClick={() => setQty(Math.min(10, qty + 1))} className="p-1 hover:text-black transition-colors"><Plus size={16} /></button>
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Max 10 per order</p>
              </div>
              <div className="flex gap-4">
                <button onClick={handleAddToCart} disabled={loadingAction} className="flex-1 h-14 bg-white border-2 border-slate-100 rounded-2xl flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-[0.2em] transition-all hover:border-black disabled:opacity-50"><ShoppingCart size={18} /> Add to Cart</button>
                <button onClick={handleBuyNow} className="flex-1 h-14 bg-black text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all hover:bg-slate-800 shadow-xl shadow-black/20">Buy Instantly</button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-6">
               <div className="flex items-center gap-3 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm"><Truck size={14} className="text-slate-600" /></div>
                  <div><p className="text-[9px] font-black uppercase tracking-widest">Free Delivery</p><p className="text-[8px] font-bold text-slate-400 mt-0.5">Orders above ₹999</p></div>
               </div>
               <div className="flex items-center gap-3 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm"><Heart size={14} className="text-slate-600" /></div>
                  <div><p className="text-[9px] font-black uppercase tracking-widest">Add to Favs</p><button onClick={handleToggleWishlist} className="text-[8px] font-bold text-slate-400 mt-0.5 underline decoration-slate-200">{isInWishlist(product.id) ? "Remove from wishlist" : "Add to wishlist"}</button></div>
               </div>
            </div>
          </div>
        </div>

        <div ref={reviewsRef} className="mt-24 border-t border-slate-100 pt-20">
          <div className="grid lg:grid-cols-3 gap-16">
            <div className="lg:col-span-2 space-y-12">
               <div className="flex justify-between items-center">
                  <h2 className="text-3xl font-black uppercase tracking-tighter">Verified Reviews</h2>
                  <div className="px-4 py-2 bg-slate-50 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-500">{reviews.length} Stories Shared</div>
               </div>
               {reviews.length > 0 ? (
                 <div className="grid gap-8">
                   {reviews.map((r) => (
                     <div key={r._id} className="group p-8 bg-slate-50 rounded-[2rem] border border-transparent hover:border-slate-200 hover:bg-white transition-all duration-300">
                       <div className="flex justify-between items-start mb-6">
                          <div className="flex items-center gap-4">
                             <div className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center font-black text-xs">{r.user?.name?.charAt(0) || "U"}</div>
                             <div><p className="font-black text-xs uppercase tracking-widest">{r.user?.name || "Guest User"}</p><p className="text-[10px] font-bold text-slate-400 mt-0.5">Verified Purchase</p></div>
                          </div>
                          <div className="flex text-yellow-500 gap-1 bg-white px-3 py-1.5 rounded-full shadow-sm">
                            {[...Array(5)].map((_, i) => <Star key={i} size={10} fill={i < r.rating ? "currentColor" : "none"} />)}
                          </div>
                       </div>
                       <p className="text-slate-600 text-sm leading-relaxed font-medium">"{r.comment}"</p>
                       <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em] pt-6 flex items-center gap-2"><span className="w-4 h-[1px] bg-slate-200" /> {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric', day: 'numeric' })}</p>
                     </div>
                   ))}
                 </div>
               ) : (
                 <div className="py-20 text-center bg-slate-50 rounded-[3rem] border border-dashed border-slate-200"><p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">No reviews yet</p></div>
               )}
            </div>

            <div className="lg:sticky lg:top-28 h-fit bg-slate-900 text-white p-10 rounded-[3rem] shadow-2xl">
               <h3 className="text-xl font-black uppercase tracking-widest mb-2">Write a Review</h3>
               <p className="text-slate-400 text-xs font-bold leading-relaxed mb-8">Share your experience with the community.</p>
               <form onSubmit={handleReviewSubmit} className="space-y-6">
                  <div className="space-y-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Your Rating</p>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((num) => (
                        <button key={num} type="button" onClick={() => setNewReview(prev => ({ ...prev, rating: num }))} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${newReview.rating >= num ? "bg-yellow-500 text-white shadow-lg shadow-yellow-500/20" : "bg-white/10 text-white/40 hover:bg-white/20"}`}><Star size={14} fill={newReview.rating >= num ? "currentColor" : "none"} /></button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Your Thoughts</p>
                    <textarea value={newReview.comment} onChange={(e) => setNewReview(prev => ({ ...prev, comment: e.target.value }))} placeholder="What did you like about this product?" className="w-full bg-white/10 border border-white/5 rounded-2xl p-5 text-sm font-medium outline-none focus:border-white/20 h-32 resize-none placeholder:text-white/20" />
                  </div>
                  <button type="submit" disabled={loadingAction} className="w-full h-14 bg-white text-black font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl hover:bg-slate-100 transition-all disabled:opacity-50">Submit for Approval</button>
                  <p className="text-[8px] text-center text-slate-500 font-bold uppercase tracking-widest">Reviews are audited before going live</p>
               </form>
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <div className="mt-32 border-t border-slate-100 pt-20">
            <div className="flex justify-between items-end mb-12">
               <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Complete the Look</p>
                  <h2 className="text-4xl font-black uppercase tracking-tighter">You May Also Like</h2>
               </div>
               <button onClick={() => navigate('/collection')} className="hidden md:block text-[10px] font-black uppercase tracking-widest border-b-2 border-black pb-1 hover:opacity-60 transition-all">Explore Full Collection</button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              {related.map((p) => (<ProductCard key={p.id} product={p} />))}
            </div>
          </div>
        )}
      </div>

      <VideoModal isOpen={showVideoModal} onClose={() => setShowVideoModal(false)} videoUrl={product.video} />
    </div>
  );
}