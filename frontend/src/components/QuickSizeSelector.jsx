import { useState } from "react";
import { X, ShoppingBag } from "lucide-react";
import { motion } from "framer-motion";

export default function QuickSizeSelector({ product, onSelect, onClose }) {
  const [selectedColorIdx, setSelectedColorIdx] = useState(0);
  const [selectedSize, setSelectedSize] = useState(null);
  const [topSize, setTopSize] = useState("");
  const [bottomSize, setBottomSize] = useState("");

  const currentVariant = product.variants?.[selectedColorIdx] || null;

  const handleConfirm = () => {
    if (currentVariant) {
      if (selectedSize) onSelect({ color: "Default", size: selectedSize, variantIdx: selectedColorIdx });
    } else {
      if (selectedSize) onSelect({ size: selectedSize });
    }
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
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Quick Selection</h4>
          <p className="text-[11px] font-black truncate max-w-[140px] uppercase tracking-tighter">{product.title}</p>
        </div>
        <button onClick={onClose} className="h-8 w-8 flex items-center justify-center hover:bg-slate-100 rounded-xl transition-all">
          <X size={16} className="text-slate-900" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 scrollbar-hide py-2">
        {/* CASE 1: SIMPLIFIED VARIANTS */}
        {product.variants?.length > 0 && (
          <>
            <div className="space-y-3">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Select Appearance</p>
              <div className="flex flex-wrap gap-2.5">
                {product.variants.map((v, i) => (
                  <button
                    key={i}
                    onClick={() => { setSelectedColorIdx(i); setSelectedSize(null); }}
                    className={`h-10 w-8 rounded-lg overflow-hidden border-2 transition-all ${selectedColorIdx === i ? "border-slate-900 scale-110 shadow-lg" : "border-transparent opacity-40"}`}
                  >
                    <img src={v.image} className="w-full h-full object-cover" alt="" />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Available Sizes</p>
              <div className="flex flex-wrap gap-1.5">
                {currentVariant?.sizes?.map((sz, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedSize(sz)}
                    className={`h-10 min-w-[40px] px-3 rounded-xl text-[10px] font-black transition-all border-2 ${selectedSize === sz ? "bg-slate-900 border-slate-900 text-white shadow-md active:scale-95" :
                        "bg-white text-slate-900 border-slate-100 hover:border-slate-300"
                      }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* CASE 2: NO VARIANTS */}
        {!product.variants?.length && (
          <div className="space-y-3">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Global Dimensions</p>
            <div className="flex flex-wrap gap-2">
              {(product.sizes || []).map(s => (
                <button
                  key={s}
                  onClick={() => setSelectedSize(s)}
                  className={`h-10 min-w-[44px] rounded-xl text-[11px] font-black transition-all border-2 ${selectedSize === s ? "bg-slate-900 border-slate-900 text-white shadow-md" : "bg-white text-slate-400 border-slate-100 hover:border-slate-200"
                    }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={handleConfirm}
        disabled={!selectedSize}
        className="w-full py-4 bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-luxury flex items-center justify-center gap-3 hover:bg-black transition-all disabled:opacity-20 active:scale-95 mt-4 group"
      >
        <ShoppingBag size={14} className="group-hover:rotate-12 transition-transform" /> Commit to Selection
      </button>
    </motion.div>
  );
}

