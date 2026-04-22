import { useState, useEffect, useMemo } from "react";
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

  /* ---------------- FETCH ---------------- */
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);

        const res = await api.get(
          ENDPOINTS.PRODUCTS.GET(id)
        );

        // API Envelope Unpacking: res.data is { success, data, message }
        const rawProduct = res.data?.data || res.data || res;
        const mapped = mapProduct(rawProduct);

        if (!mounted) return;

        setProduct(mapped);

        /* reviews */
        const revRes = await api.get(`${ENDPOINTS.REVIEWS}/${id}`);
        setReviews(revRes.data?.data || []);

        /* related */
        const rel = await api.get(
          `${ENDPOINTS.PRODUCTS.LIST}?category=${mapped.category?.main}&limit=8`
        );

        const relData = (rel.data?.data || rel.data || []).map(mapProduct);

        setRelated(relData.filter((p) => p.id !== id));
      } catch {
        toast.error("Failed to load product");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    window.scrollTo(0, 0);

    return () => {
      mounted = false;
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

  const discount =
    originalPrice > price
      ? Math.round(
        ((originalPrice - price) / originalPrice) * 100
      )
      : 0;

  /* ---------------- ACTIONS ---------------- */
  const handleAddToCart = () => {
    if (!isAuthenticated) {
      toast.error("Please login first");
      return navigate("/login", { state: { from: location } });
    }

    if (!product?.id) return toast.error("Product ID missing");

    if (!selectedSize && product?.sizes?.length) {
      return toast.error("Please select a size");
    }

    addToCart(product.id, qty, selectedSize, null, null, selectedColor);
    toast.success("Added to cart");
  };

  const handleToggleWishlist = () => {
    if (!isAuthenticated) {
      toast.error("Please login first");
      return navigate("/login", { state: { from: location } });
    }
    toggleWishlist(product.id);
  };

  const handleBuyNow = () => {
    if (!isAuthenticated) {
      return navigate("/login", {
        state: { from: location },
      });
    }

    if (!selectedSize && product?.sizes?.length) {
      return toast.error("Please select a size");
    }

    navigate("/checkout", {
      state: {
        buyNowProduct: {
          ...product,
          quantity: qty,
          selectedSize,
        },
      },
    });
  };

  /* ---------------- LOADING ---------------- */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-10 w-10 border-2 border-black border-t-transparent animate-spin rounded-full" />
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
        <button
          onClick={() => navigate("/collection")}
          className="px-5 py-2 bg-black text-white rounded-lg"
        >
          Back to shop
        </button>
      </div>
    );
  }

  /* ---------------- UI ---------------- */
  return (
    <div className="bg-white min-h-screen pb-20">
      <div className="max-w-6xl mx-auto px-4 py-6 grid lg:grid-cols-2 gap-8">
        {/* IMAGES */}
        <div>
          <div className="aspect-[3/4] bg-gray-100 rounded-xl overflow-hidden">
            <SafeImage
              src={gallery[activeImage]}
              alt={product.title}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex gap-2 mt-3 overflow-x-auto">
            {gallery.map((img, i) => (
              <button
                key={i}
                onClick={() => setActiveImage(i)}
                className={`h-16 w-12 rounded overflow-hidden border ${activeImage === i
                    ? "border-black"
                    : "border-gray-200"
                  }`}
              >
                <SafeImage
                  src={img}
                  alt="thumb"
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>

        {/* INFO */}
        <div className="space-y-5">
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-gray-500 flex items-center gap-1"
          >
            <ArrowLeft size={14} /> Back
          </button>

          <h1 className="text-2xl font-semibold">
            {product.title}
          </h1>

          {/* Rating */}
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="flex text-yellow-500">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={14} />
              ))}
            </div>
            {product.ratings?.count || 0} reviews
          </div>

          {/* Price */}
          <div className="flex items-center gap-3">
            <span className="text-2xl font-semibold">
              {formatPrice(price)}
            </span>

            {discount > 0 && (
              <>
                <span className="line-through text-gray-400">
                  {formatPrice(originalPrice)}
                </span>
                <span className="text-green-600 text-sm">
                  {discount}% OFF
                </span>
              </>
            )}
          </div>

          {/* Colors (Variants) */}
          {product.variants?.length > 0 && (
            <div>
              <p className="text-sm mb-2 font-medium">Color: <span className="text-slate-500">{selectedColor}</span></p>
              <div className="flex gap-4">
                {[...new Set(product.variants.map(v => v.color))].map((c) => (
                  <button
                    key={c}
                    onClick={() => setSelectedColor(c)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${selectedColor === c ? 'border-black scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: product.variants.find(v => v.color === c)?.colorCode || c }}
                    title={c}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Sizes */}
          {product.sizes?.length > 0 && (
            <div>
              <p className="text-sm mb-2 font-medium">Select Size</p>
              <div className="flex gap-2 flex-wrap">
                {product.sizes.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedSize(s)}
                    className={`px-4 py-2 border rounded font-medium transition-all ${selectedSize === s
                      ? "bg-black text-white border-black"
                      : "bg-white hover:border-black"
                      }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Qty */}
          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                setQty(Math.max(1, qty - 1))
              }
            >
              <Minus size={16} />
            </button>
            <span>{qty}</span>
            <button
              onClick={() =>
                setQty(Math.min(10, qty + 1))
              }
            >
              <Plus size={16} />
            </button>
          </div>

          {/* CTA */}
          <div className="flex gap-3">
            <button
              onClick={handleAddToCart}
              className="flex-1 h-12 border rounded-lg flex items-center justify-center gap-2"
            >
              <ShoppingCart size={16} />
              Add to Cart
            </button>

            <button
              onClick={handleBuyNow}
              className="flex-1 h-12 bg-black text-white rounded-lg"
            >
              Buy Now
            </button>
          </div>

          {/* Delivery */}
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Truck size={14} />
            Delivery in 3-5 days
          </div>

          {/* Wishlist + Share */}
          <div className="flex gap-4">
            <button
              onClick={handleToggleWishlist}
              className="p-3 border rounded-xl hover:bg-slate-50 transition-colors"
            >
              <Heart
                size={20}
                className={isInWishlist(product.id) ? "text-red-500 fill-red-500" : "text-slate-400"}
              />
            </button>

            <button
              onClick={() =>
                navigator.clipboard.writeText(
                  window.location.href
                )
              }
            >
              <Share2 size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* REVIEWS SECTION */}
      <div className="max-w-6xl mx-auto px-4 mt-20 border-t pt-16">
         <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
            Customer Reviews
            <span className="text-slate-400 text-sm font-normal">({reviews.length})</span>
         </h2>

         {reviews.length > 0 ? (
           <div className="grid md:grid-cols-2 gap-8">
             {reviews.map((r) => (
               <div key={r._id} className="bg-slate-50 p-6 rounded-2xl space-y-3">
                 <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-900">{r.user?.name || "Guest User"}</span>
                    <div className="flex text-yellow-500 gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={12} fill={i < r.rating ? "currentColor" : "none"} />
                      ))}
                    </div>
                 </div>
                 <p className="text-slate-600 text-sm leading-relaxed">{r.comment}</p>
                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest pt-2">
                   {new Date(r.createdAt).toLocaleDateString()}
                 </p>
               </div>
             ))}
           </div>
         ) : (
           <div className="bg-slate-50 py-12 text-center rounded-3xl">
              <p className="text-slate-500 font-medium">No reviews yet. Be the first to share your experience!</p>
           </div>
         )}
      </div>

      {/* RELATED */}
      {related.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 mt-20 border-t pt-16">
          <h2 className="text-2xl font-bold mb-8">
            You may also like
          </h2>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}