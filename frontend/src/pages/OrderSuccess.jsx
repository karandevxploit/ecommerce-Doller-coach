import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../api/client";
import { mapOrder } from "../api/dynamicMapper";
import { ArrowRight, Check, Copy, ShoppingBag, CreditCard, Box, Truck, Loader2 } from "lucide-react";
import { formatPrice } from "../utils/format";
import { motion, AnimatePresence } from "framer-motion";

// --- Sub-Components for Code Quality ---

const SuccessHeader = () => (
  <div className="flex flex-col items-center text-center space-y-3">
    <motion.div
      initial={{ scale: 0, rotate: -45 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", damping: 12, stiffness: 200 }}
      className="h-14 w-14 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/20"
    >
      <Check className="text-white" size={28} strokeWidth={3} />
    </motion.div>
    <div className="space-y-1">
      <h1 className="text-2xl font-bold text-white tracking-tight">Order Confirmed 🎉</h1>
      <p className="text-gray-400 text-sm">Your order has been placed successfully</p>
    </div>
  </div>
);

const OrderIdPill = ({ id }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    toast.success("Order ID copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 shadow-inner group"
    >
      <span className="text-[10px] font-medium text-gray-500 uppercase tracking-widest">Order ID:</span>
      <span className="text-xs font-bold text-white tracking-widest">#{id?.slice(-8).toUpperCase()}</span>
      <button 
        onClick={handleCopy}
        className="text-gray-500 hover:text-blue-400 transition-colors ml-1"
        title="Copy ID"
      >
        {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
      </button>
    </motion.div>
  );
};

const OrderCard = ({ order }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay: 0.3 }}
    className="w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-5 md:p-6 shadow-xl transition-shadow duration-500"
  >
    {/* Card Top Row */}
    <div className="flex justify-between items-center mb-5 border-b border-white/5 pb-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Status</span>
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-full">
          <div className="h-1 w-1 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Processing</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-0.5">
        <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Total</span>
        <span className="text-xl font-black text-white tracking-tight">{formatPrice(order.totalAmount)}</span>
      </div>
    </div>

    {/* Product List */}
    <div className="space-y-4">
      {(order.products || []).map((product, idx) => (
        <div key={idx} className="flex items-center gap-4 group">
          <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-white/5 border border-white/10 flex-shrink-0">
            <img
              src={product.image || "/placeholder.png"}
              alt={product.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
            <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded-md text-[8px] font-bold text-white border border-white/10">
              x{product.quantity}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-white tracking-tight truncate transition-colors">
              {product.title}
            </h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-medium text-gray-500 border-r border-white/10 pr-2">Reg.</span>
              <span className="text-[10px] font-medium text-gray-500">#{product.id?.slice(-4).toUpperCase()}</span>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs font-bold text-white tracking-tight">{formatPrice(product.price)}</p>
          </div>
        </div>
      ))}
    </div>

    {/* Summary Details */}
    <div className="mt-5 pt-5 border-t border-white/5 grid grid-cols-2 gap-4">
        <div className="space-y-0.5">
            <p className="text-[8px] uppercase tracking-widest text-gray-500 font-bold">Payment</p>
            <div className="flex items-center gap-1.5 text-white">
                <CreditCard size={12} className="text-blue-500" />
                <span className="text-[10px] font-bold">Secure</span>
            </div>
        </div>
        <div className="space-y-0.5 text-right md:text-left">
            <p className="text-[8px] uppercase tracking-widest text-gray-500 font-bold">Logistics</p>
            <div className="flex items-center justify-end md:justify-start gap-1.5 text-white">
                <Truck size={12} className="text-blue-500" />
                <span className="text-[10px] font-bold">Express</span>
            </div>
        </div>
    </div>
  </motion.div>
);

const ActionButtons = ({ navigate }) => (
  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate("/")}
      className="w-full sm:w-auto px-8 h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold text-sm shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2"
    >
      Continue Shopping <ArrowRight size={18} />
    </motion.button>
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate("/profile")}
      className="w-full sm:w-auto px-8 h-11 bg-transparent border border-white/20 hover:bg-white/5 text-white rounded-full font-bold text-sm transition-all flex items-center justify-center gap-2"
    >
      View Orders
    </motion.button>
  </div>
);

// --- Main Page Component ---

function OrderSuccess() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/orders/${id}`);
        const mapped = mapOrder(res);
        if (!cancelled) setOrder(mapped);
      } catch (err) {
        console.error("Order fetch error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => (cancelled = true);
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f172a] to-[#1e293b]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
          <p className="text-gray-400 text-[10px] font-medium tracking-widest uppercase">Initializing...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#0f172a] to-[#1e293b] px-6 text-center">
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center text-red-500 mb-6">
           <Box size={32} />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight mb-2">Order Not Found</h2>
        <p className="text-gray-400 text-sm mb-6 max-w-sm mx-auto">Sequence could not be retrieved.</p>
        <button
          onClick={() => navigate("/")}
          className="h-11 px-8 bg-white text-[#0f172a] rounded-full font-bold text-sm hover:bg-gray-200 transition-all shadow-xl"
        >
          Return to Base
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] to-[#1e293b] flex items-center justify-center py-10 px-6">
      
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full max-w-2xl flex flex-col items-center gap-6 relative z-10"
      >
        <SuccessHeader />
        
        <OrderIdPill id={order.id} />

        <OrderCard order={order} />

        <ActionButtons navigate={navigate} />

        {/* Brand Indicators */}
        <div className="mt-2 flex flex-col items-center gap-4 opacity-60">
           <div className="flex justify-center gap-6 border-t border-white/5 pt-6 w-full max-w-sm">
              <div className="flex items-center gap-1.5 text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                 <ShoppingBag size={12} className="text-blue-500" /> Secure
              </div>
              <div className="flex items-center gap-1.5 text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                 <Truck size={12} className="text-blue-500" /> Express
              </div>
           </div>
           <p className="text-[9px] text-gray-500 text-center uppercase tracking-widest leading-relaxed max-w-xs transition-opacity duration-1000">
             Luxury aesthetic by DOLLER Coach. Receipt authorization complete.
           </p>
        </div>
      </motion.div>
    </div>
  );
}

export default OrderSuccess;