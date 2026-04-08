import { useState } from "react";
import { X, ShoppingBag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function QuickSizeSelector({  onSelect, onClose }) {
  const [topSize, setTopSize] = useState("");
  const [bottomSize, setBottomSize] = useState("");

  const topOptions = ["S", "M", "L", "XL", "XXL"];
  const bottomOptions = ["28", "30", "32", "34", "36", "38"];

  const handleAdd = () => {
    if (!topSize || !bottomSize) return;
    onSelect({ topSize, bottomSize });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="absolute inset-0 z-50 bg-white/95 backdrop-blur-md p-4 flex flex-col justify-between"
    >
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Select Sizes</h4>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
          <X size={14} className="text-gray-900" />
        </button>
      </div>

      <div className="space-y-4 flex-1 flex flex-col justify-center">
        <div>
          <p className="text-[8px] font-black text-gray-300 uppercase mb-2 tracking-widest">Topwear (T)</p>
          <div className="flex flex-wrap gap-1.5">
            {topOptions.map((s) => (
              <button
                key={s}
                onClick={() => setTopSize(s)}
                className={`h-7 px-2 min-w-[32px] rounded-md text-[9px] font-black transition-all border ${
                  topSize === s 
                    ? "bg-[#0f172a] text-white border-[#0f172a]" 
                    : "bg-white text-gray-400 border-gray-100 hover:border-gray-300"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[8px] font-black text-gray-300 uppercase mb-2 tracking-widest">Bottomwear (B)</p>
          <div className="flex flex-wrap gap-1.5">
            {bottomOptions.map((s) => (
              <button
                key={s}
                onClick={() => setBottomSize(s)}
                className={`h-7 px-2 min-w-[32px] rounded-md text-[9px] font-black transition-all border ${
                  bottomSize === s 
                    ? "bg-[#0f172a] text-white border-[#0f172a]" 
                    : "bg-white text-gray-400 border-gray-100 hover:border-gray-300"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={handleAdd}
        disabled={!topSize || !bottomSize}
        className="w-full py-2.5 bg-[#0f172a] text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-lg flex items-center justify-center gap-2 hover:bg-[#1e3a8a] transition-all disabled:opacity-30 active:scale-95 mt-4"
      >
        <ShoppingBag size={14} /> Confirm Selection
      </button>
    </motion.div>
  );
}
