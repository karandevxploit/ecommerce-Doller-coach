import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import {
  Package,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
} from "lucide-react";
import toast from "react-hot-toast";
import { getCategoryFallback } from "../utils/imageFallbacks";
import { mapOrder } from "../api/dynamicMapper";
import { useSafeInterval } from "../hooks/useSafeInterval";

const StatusBadge = ({ status }) => {
  const map = {
    placed: {
      style: "bg-blue-50 text-blue-600",
      icon: <Clock size={12} />,
      label: "Order Placed",
    },
    confirmed: {
      style: "bg-indigo-50 text-indigo-600",
      icon: <Package size={12} />,
      label: "Confirmed",
    },
    shipped: {
      style: "bg-orange-50 text-orange-600",
      icon: <Truck size={12} />,
      label: "Shipped",
    },
    delivered: {
      style: "bg-green-50 text-green-600",
      icon: <CheckCircle size={12} />,
      label: "Delivered",
    },
    cancelled: {
      style: "bg-red-50 text-red-600",
      icon: <XCircle size={12} />,
      label: "Cancelled",
    },
  };

  const current = map[status] || map.placed;

  return (
    <div
      className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${current.style}`}
    >
      {current.icon}
      {current.label}
    </div>
  );
};

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchOrders = async () => {
    try {
      const res = await api.get("/orders/my");
      const list = Array.isArray(res)
        ? res
        : res?.data || [];

      setOrders(list.map(mapOrder));
    } catch (err) {
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  /* Auto refresh */
  useSafeInterval(fetchOrders, 15000);

  /* ---------------- LOADING ---------------- */
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="animate-spin h-8 w-8 border-2 border-black border-t-transparent rounded-full" />
        <p className="text-sm text-gray-500">
          Loading your orders...
        </p>
      </div>
    );
  }

  /* ---------------- EMPTY ---------------- */
  if (!orders.length) {
    return (
      <div className="max-w-md mx-auto text-center py-20 px-4">
        <Package
          size={48}
          className="mx-auto text-gray-300 mb-4"
        />
        <h2 className="text-xl font-semibold text-gray-900">
          No orders yet
        </h2>
        <p className="text-gray-500 mt-2 mb-6">
          You haven’t placed any orders yet
        </p>
        <button
          onClick={() => navigate("/collection")}
          className="px-6 py-3 bg-black text-white rounded-lg"
        >
          Start Shopping
        </button>
      </div>
    );
  }

  /* ---------------- UI ---------------- */
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-semibold">
        My Orders
      </h1>

      {orders.map((order) => (
        <div
          key={order.id}
          className="border rounded-xl p-4 bg-white"
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <div>
              <p className="text-sm font-medium">
                Order #{String(order.id).slice(-6)}
              </p>
              <p className="text-xs text-gray-500">
                {new Date(
                  order.createdAt
                ).toLocaleDateString()}
              </p>
            </div>

            <StatusBadge status={order.status} />
          </div>

          {/* Items */}
          <div className="space-y-3">
            {order.products?.map((item, i) => {
              const img =
                item?.image ||
                item?.images?.[0] ||
                getCategoryFallback(item?.category);

              return (
                <div
                  key={i}
                  className="flex items-center gap-3"
                >
                  <img
                    src={img}
                    alt={item?.title || "Product"}
                    className="w-14 h-14 object-cover rounded-lg"
                  />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {item?.title || "Product"}
                    </p>
                    <p className="text-xs text-gray-500">
                      Qty: {item.quantity || 1}
                    </p>
                  </div>

                  <p className="text-sm font-medium">
                    ₹
                    {(item.price || 0) *
                      (item.quantity || 1)}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Tracking Timeline (NEW) */}
          <div className="mt-6 mb-8 px-2">
            <div className="relative flex justify-between">
              {/* Progress Line */}
              <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -translate-y-1/2 z-0" />
              <div 
                className={`absolute top-1/2 left-0 h-0.5 bg-black -translate-y-1/2 z-0 transition-all duration-1000`} 
                style={{ 
                  width: order.status === "delivered" ? "100%" : order.status === "shipped" ? "50%" : "0%" 
                }} 
              />

              {[
                { id: "placed", label: "Ordered", icon: <CheckCircle size={10} /> },
                { id: "shipped", label: "Shipped", icon: <Truck size={10} /> },
                { id: "delivered", label: "Delivered", icon: <Package size={10} /> }
              ].map((step, idx) => {
                const isActive = order.status === step.id || 
                                (step.id === "placed") || 
                                (step.id === "shipped" && order.status === "delivered");
                
                return (
                  <div key={idx} className="relative z-10 flex flex-col items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors duration-500 bg-white ${
                      isActive ? "border-black text-black" : "border-slate-200 text-slate-300"
                    }`}>
                      {isActive ? <CheckCircle size={12} fill="currentColor" className="text-white bg-black rounded-full" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />}
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-tighter ${
                      isActive ? "text-black" : "text-slate-400"
                    }`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Shiprocket Details (IF SYNCED) */}
          {order.shiprocket?.awbCode && (
            <div className="mb-6 bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex gap-4 items-center">
                <div className="p-3 bg-white rounded-lg shadow-sm">
                  <Truck size={20} className="text-slate-600" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Courier: {order.shiprocket.courierName || "Standard"}</p>
                  <p className="text-xs font-black text-slate-900 font-mono tracking-tighter">Tracking ID: {order.shiprocket.awbCode}</p>
                </div>
              </div>
              
              <a 
                href={order.shiprocket.trackingUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-full md:w-auto px-6 py-2.5 bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:shadow-xl active:scale-95 transition-all text-center"
              >
                Track Live
              </a>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-between items-center mt-4 pt-4 border-t">
            <p className="font-bold text-lg">
              Total: ₹{order.total || 0}
            </p>

            <button
              onClick={() =>
                navigate(
                  `/product/${order.products?.[0]?.id ||
                  order.products?.[0]?._id
                  }`
                )
              }
              className="flex items-center gap-1 text-sm font-bold text-slate-900 hover:underline"
            >
              Order Details <ChevronRight size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}