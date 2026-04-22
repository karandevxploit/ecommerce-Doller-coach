import React from 'react';
import { Sparkles, ShoppingBag, Heart } from 'lucide-react';

const ProductCard = ({ product }) => {
  const {
    title = "Product Title",
    price = 0,
    originalPrice = 0,
    category = "Category",
    badge = { text: "", color: "#0f172a", enabled: false },
    variants = [],
    offer = { text: "", enabled: false }
  } = product;

  const discount = originalPrice > price 
    ? Math.round(((originalPrice - price) / originalPrice) * 100) 
    : 0;

  const activeImage = variants[0]?.images[0] || "https://placehold.co/400x500/0f172a/ffffff?text=Product+Image";

  return (
    <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl shadow-slate-200/50 group transition-all duration-500 hover:-translate-y-2">
      {/* Image Section */}
      <div className="relative aspect-[4/5] overflow-hidden bg-slate-100">
        <img 
          src={activeImage} 
          alt={title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        
        {/* Badges */}
        <div className="absolute top-4 left-4 flex flex-col gap-2">
          {badge.enabled && (
            <span 
              className="px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase text-white shadow-lg"
              style={{ backgroundColor: badge.color }}
            >
              {badge.text}
            </span>
          )}
          {discount > 0 && (
            <span className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase text-white shadow-lg ${discount > 50 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`}>
              {discount}% OFF
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 translate-x-12 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300">
          <button className="p-2 bg-white/90 backdrop-blur-md rounded-full shadow-lg hover:bg-white text-slate-800">
            <Heart size={18} />
          </button>
        </div>

        {/* Hover Add to Cart */}
        <div className="absolute bottom-0 inset-x-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-500">
          <button className="w-full py-3 bg-slate-900 text-white rounded-2xl font-bold text-sm tracking-widest uppercase flex items-center justify-center gap-2 shadow-xl">
            <ShoppingBag size={18} />
            Quick Add
          </button>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-6 space-y-2">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">{typeof category === 'object' ? category?.main : category}</p>
            <h3 className="text-lg font-bold text-slate-800 leading-tight mt-1">{title || "Untitled Product"}</h3>
          </div>
          {discount > 50 && (
            <div className="flex items-center gap-1 text-rose-500">
              <Sparkles size={14} fill="currentColor" />
              <span className="text-[10px] font-black uppercase tracking-tighter">Hot</span>
            </div>
          )}
        </div>

        <div className="flex items-baseline gap-2 pt-2">
          <span className="text-xl font-black text-slate-900">₹{price}</span>
          {originalPrice > price && (
            <span className="text-sm font-medium text-slate-400 line-through">₹{originalPrice}</span>
          )}
        </div>

        {offer.enabled && offer.text && (
          <p className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg inline-block">
            {offer.text}
          </p>
        )}

        {/* Variant Swatches */}
        {variants.length > 0 && (
          <div className="flex gap-1.5 pt-2">
            {variants.slice(0, 5).map((v, i) => (
              <div 
                key={i}
                className="w-4 h-4 rounded-full border border-slate-200 ring-2 ring-transparent hover:ring-slate-300 transition-all"
                style={{ backgroundColor: v.colorCode || '#ddd' }}
                title={v.color}
              />
            ))}
            {variants.length > 5 && (
              <span className="text-[10px] font-bold text-slate-400">+{variants.length - 5}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductCard;
