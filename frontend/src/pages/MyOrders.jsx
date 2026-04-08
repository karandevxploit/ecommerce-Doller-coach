import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { Package, ChevronRight, Clock, CheckCircle, XCircle, Truck } from "lucide-react";
import toast from "react-hot-toast";
import { getCategoryFallback } from "../utils/imageFallbacks";

import { mapOrder } from "../api/dynamicMapper";

const StatusBadge = ({ status }) => {
  const styles = {
    placed: "bg-blue-50 text-blue-600 border-blue-100",
    confirmed: "bg-indigo-50 text-indigo-600 border-indigo-100",
    shipped: "bg-orange-50 text-orange-600 border-orange-100",
    delivered: "bg-green-50 text-green-600 border-green-100",
    cancelled: "bg-red-50 text-red-700 border-red-100",
  };

  const icons = {
    placed: <Clock size={12} />,
    confirmed: <Package size={12} />,
    shipped: <Truck size={12} />,
    delivered: <CheckCircle size={12} />,
    cancelled: <XCircle size={12} />,
  };

  return (
    <div 
      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${styles[status] || styles.placed}`}
    >
      {icons[status] || icons.placed}
      {status}
    </div>
  );
};

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await api.get("/orders/my");
        const list = res.data || [];
        setOrders(Array.isArray(list) ? list.map(mapOrder) : []);
      } catch (err) {
        console.error("Orders Sync Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();

    // POLLING: Auto-sync every 10 seconds for status updates
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, []);

  const containerVars = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.12 }
    }
  };

  const itemVars = {
    hidden: { opacity: 0, y: 30 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#0f172a]"></div>
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Archiving Manifest</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div 
        className="flex flex-col gap-2"
      >
        <div className="flex items-center gap-2">
          <Package size={16} className="text-[#0f172a]" />
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">Transaction History</span>
        </div>
        <h1 className="text-4xl font-black tracking-tighter text-[#0f172a] uppercase leading-none">
          My Orders
        </h1>
      </div>

      {orders.length === 0 ? (
        <div 
          className="bg-[#f1f5f9] rounded-3xl p-12 text-center border border-[#F2F2F2]"
        >
          <Package size={48} className="mx-auto text-gray-300 mb-4" />
          <h2 className="text-xl font-bold text-[#0f172a] mb-2">Manifest Unknown</h2>
          <p className="text-sm text-gray-500 mb-6 font-medium">No order data found in your archive.</p>
          <button 
            onClick={() => navigate("/collection")}
            className="px-6 py-3 bg-[#0f172a] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] transition-all"
          >
            Explore Manifest
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => (
            <div
              key={order.id}
              className="group bg-white border border-[#F2F2F2] rounded-3xl p-6 shadow-sm transition-all duration-500 overflow-hidden relative"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-[#0f172a] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="flex justify-between items-start mb-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">
                    ID: {String(order.id).slice(-8).toUpperCase()}
                  </p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">
                    {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <StatusBadge status={order.status} />
              </div>

              <div className="space-y-4">
                {order.products.map((item, idx) => (
                  <div key={idx} className="flex gap-4 items-center">
                    <div className="h-16 w-16 rounded-2xl bg-[#f1f5f9] overflow-hidden border border-gray-100 flex-shrink-0">
                      <img 
                        src={item?.image || (item?.images && item.images[0]) || getCategoryFallback(item?.category)} 
                        alt={item?.title || "Item"} 
                        className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-500"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-black text-[#0f172a] truncate uppercase tracking-tight">
                        {item?.title || "Unnamed Manifest Item"}
                      </h3>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        {item.topSize && item.bottomSize 
                          ? `SET: ${item.topSize} / ${item.bottomSize}`
                          : `SIZE: ${item.size || 'N/A'}`} 
                        <span className="mx-2">•</span>
                        QTY: {item.quantity}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-[#0f172a]">₹{item.price * item.quantity}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-50 flex justify-between items-center">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Total Amount</p>
                  <p className="text-lg font-black text-[#0f172a]">₹{order.totalAmount}</p>
                </div>
                <button 
                  onClick={() => navigate(`/product/${order.products?.[0]?.id || order.products?.[0]?._id}`)}
                  className="h-10 w-10 flex items-center justify-center rounded-xl bg-[#f1f5f9] text-[#0f172a] hover:bg-[#0f172a] hover:text-white transition-all transform group-hover:translate-x-1"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
