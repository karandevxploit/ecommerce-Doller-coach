import { memo, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore, useCartStore, useWishlistStore } from "@/store";
import { Heart, ShoppingBag, ArrowRight, Zap, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { formatPrice } from "../utils/format";
import QuickSizeSelector from "./QuickSizeSelector";

function ProductCard({ product }) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { addToCart } = useCartStore();
  const { toggleWishlist, isInWishlist } = useWishlistStore();  const [showSizeSelector, setShowSizeSelector] = useState(false);
  const isWishlisted = isInWishlist(product._id || product.id);

  const discount = Number(product?.discountPrice ? (1 - product.discountPrice / product.originalPrice) * 100 : product?.discount || 0);

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!product || product.stock <= 0) return toast.error("Stock Out of Stock.");
    
    if (product.type === "FULL_OUTFIT") {
      setShowSizeSelector(true);
    } else {
      addToCart(product._id || product.id, 1);
      toast.success("System Added to Cart.");
    }
  };

  const handleQuickSelect = ({ topSize, bottomSize }) => {
    addToCart(product._id || product.id, 1, null, topSize, bottomSize);
    setShowSizeSelector(false);
    toast.success("Combo Added to Bag.");
  };

  const handleWishlist = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) return navigate("/login");
    await toggleWishlist(product._id || product.id);
  };

  const getOptimizedImage = (url) => {
    if (!url) return "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=436&auto=format&fit=crop&q=80";
    if (url.includes("res.cloudinary.com") && !url.includes("f_auto")) {
      return url.replace("/upload/", "/upload/f_auto,q_auto/");
    }
    return url;
  };

  return (
    <motion.div 
      whileHover={{ y: -8, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } }}
      className={`bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-2xl transition-all flex flex-col h-full relative group ${product.type === 'FULL_OUTFIT' ? 'ring-1 ring-indigo-50 border-indigo-100' : ''}`}
    >
      <Link to={(product._id || product.id) ? `/product/${product._id || product.id}` : "/collection"} className="flex flex-col h-full">
        {/* IMAGE */}
        <div
          className="relative h-48 overflow-hidden bg-gray-50 border-b border-gray-50"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <img
            src={getOptimizedImage(product.images?.[0] || product.image)}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            alt={product.title}
          />

          {/* BADGES */}
          <div className="absolute top-2 left-2 z-20 flex flex-col gap-1.5">
             {product.type === 'FULL_OUTFIT' && (
               <motion.div 
                 animate={{ opacity: [0.8, 1, 0.8], scale: [0.98, 1, 0.98] }}
                 transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                 className="bg-indigo-600 text-white px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest flex items-center gap-1 shadow-lg"
               >
                 <Sparkles size={10} className="fill-white" /> Full Outfit
               </motion.div>
             )}
             {discount > 0 && (
               <motion.div 
                 animate={{ y: [0, -2, 0] }}
                 transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                 className="bg-[#0f172a] text-white px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest shadow-lg"
               >
                 {Math.round(discount)}% OFF
               </motion.div>
             )}
          </div>

          <button
            type="button"
            onClick={handleWishlist}
            className={`absolute top-2 right-2 z-20 p-1.5 backdrop-blur-md rounded-full transition-all shadow-sm border ${
              isWishlisted 
                ? "bg-red-500 text-white border-red-500" 
                : "bg-white/95 text-gray-400 border-gray-100 hover:text-red-500"
            }`}
            aria-label="Add to wishlist"
          >
            <Heart size={16} fill={isWishlisted ? "currentColor" : "none"} strokeWidth={isWishlisted ? 0 : 2} />
          </button>

          {/* ADD TO CART OVERLAY */}
          <div className="absolute bottom-2 left-2 right-2 z-20">
            <motion.button
              whileTap={{ scale: 0.92 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              type="button"
              onClick={handleAddToCart}
              className="w-full py-2.5 bg-[#0f172a] text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-xl flex items-center justify-center gap-2 hover:bg-black transition-colors"
            >
              <ShoppingBag size={14} /> Add to bag
            </motion.button>
          </div>

          {/* QUICK SIZE SELECTOR OVERLAY */}
          <AnimatePresence>
            {showSizeSelector && (
              <QuickSizeSelector 
                product={product} 
                onSelect={handleQuickSelect} 
                onClose={() => setShowSizeSelector(false)} 
              />
            )}
          </AnimatePresence>
        </div>

        {/* CONTENT */}
        <div className="p-3 space-y-1 flex-1 flex flex-col justify-end">
          <div className="space-y-1">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest leading-none mb-1">
                {product.category || "General"}
              </span>
            </div>
            <h3 className="text-sm font-bold text-gray-900 line-clamp-2 leading-tight">
              {product.title}
            </h3>
          </div>
          
          <div className="flex items-center justify-between pt-2">
            <span className="text-base font-black text-gray-900 tracking-tighter">
              {formatPrice(product.price)}
            </span>
            {product.type === 'FULL_OUTFIT' && (
              <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-50 px-1.5 py-0.5 rounded leading-none">
                Combo Set
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default memo(ProductCard);