import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { ENDPOINTS } from "../api/endpoints";
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
import SafeImage from "../components/ui/SafeImage";
import { formatPrice } from "../utils/format";

const ORDER_FLOW = [
  "placed",
  "confirmed",
  "processing",
  "shipped",
  "out_for_delivery",
  "delivered",
];

const TRACKING_STEPS = [
  { id: "placed", label: "Placed" },
  { id: "processing", label: "Processing" },
  { id: "shipped", label: "Shipped" },
  { id: "out_for_delivery", label: "Out for delivery" },
  { id: "delivered", label: "Delivered" },
];

const safeDate = (date) => {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString();
};

const safeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
const DELIVERY_FEE = 40;
const COD_FEE = 50;

const getDisplayTotal = (order = {}) => {
  const products = Array.isArray(order.products) ? order.products : [];
  const computedSubtotal = products.reduce((sum, item) => {
    const quantity = Math.max(1, safeNumber(item?.quantity, 1));
    return sum + safeNumber(item?.price) * quantity;
  }, 0);
  const subtotal = safeNumber(order.subtotal, computedSubtotal);
  const discount = safeNumber(order.discount);
  const gst = safeNumber(order.gst, Math.round(subtotal * 0.18));
  const delivery = safeNumber(order.delivery, DELIVERY_FEE) || DELIVERY_FEE;
  const codFee = String(order.paymentMethod || "COD").toUpperCase() === "COD"
    ? Math.max(safeNumber(order.codFee), COD_FEE)
    : 0;
  return subtotal - discount + gst + delivery + codFee;
};

const getOrderList = (response) => {
  const data = response?.data ?? response;
  const payload = data?.data ?? data;

  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.orders)) return payload.orders;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;

  return [];
};

const isValidUrl = (url) => {
  try {
    return Boolean(new URL(url));
  } catch {
    return false;
  }
};

const StatusBadge = ({ status }) => {
  const normalizedStatus = String(status || "placed").toLowerCase();

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
    processing: {
      style: "bg-purple-50 text-purple-600",
      icon: <Package size={12} />,
      label: "Processing",
    },
    shipped: {
      style: "bg-orange-50 text-orange-600",
      icon: <Truck size={12} />,
      label: "Shipped",
    },
    out_for_delivery: {
      style: "bg-amber-50 text-amber-600",
      icon: <Truck size={12} />,
      label: "Out for Delivery",
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

  const current = map[normalizedStatus] || map.placed;

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

  const fetchOrders = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (!silent) setLoading(true);

        const endpoint = ENDPOINTS?.ORDERS?.MY || "/orders/my";
        const res = await api.get(endpoint);

        const mappedOrders = getOrderList(res).map(mapOrder).filter(Boolean);
        setOrders(mappedOrders);
      } catch (err) {
        if (!silent) {
          toast.error(
            err?.response?.data?.message || "Failed to load orders"
          );
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  /* Auto refresh */
  useSafeInterval(() => fetchOrders({ silent: true }), 15000);

  const handleOrderDetails = (order) => {
    const orderId = order?.id || order?._id;

    if (orderId) {
      navigate(`/order/${orderId}`);
      return;
    }

    const firstProductId = order?.products?.[0]?.id || order?.products?.[0]?._id;

    if (firstProductId) {
      navigate(`/product/${firstProductId}`);
    }
  };

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
        <Package size={48} className="mx-auto text-gray-300 mb-4" />

        <h2 className="text-xl font-semibold text-gray-900">
          No orders yet
        </h2>

        <p className="text-gray-500 mt-2 mb-6">
          You haven’t placed any orders yet
        </p>

        <button
          type="button"
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
      <h1 className="text-2xl font-semibold">My Orders</h1>

      {orders.map((order, orderIndex) => {
        const orderId = order.id || order._id || `order-${orderIndex}`;
        const status = String(order.status || "placed").toLowerCase();
        const isCancelled = status === "cancelled";
        const currentIdx = Math.max(ORDER_FLOW.indexOf(status), 0);
        const progressWidth = isCancelled
          ? "0%"
          : status === "delivered"
            ? "100%"
            : status === "out_for_delivery"
              ? "75%"
              : status === "shipped"
                ? "50%"
                : status === "processing" || status === "confirmed"
                  ? "25%"
                  : "0%";

        const shipment = order.shipment || order.shiprocket || {};
        const trackingUrl = shipment.trackingUrl;
        const hasTracking = shipment.awbCode || order.shiprocket?.awbCode;

        return (
          <div key={orderId} className="border rounded-xl p-4 bg-white">
            {/* Header */}
            <div className="flex justify-between items-center gap-4 mb-4">
              <div>
                <p className="text-sm font-medium">
                  Order #{String(orderId).slice(-6)}
                </p>

                <p className="text-xs text-gray-500">
                  {safeDate(order.createdAt)}
                </p>
              </div>

              <StatusBadge status={status} />
            </div>

            {/* Items */}
            <div className="space-y-3">
              {(order.products || []).map((item, index) => {
                const quantity = Math.max(1, safeNumber(item.quantity, 1));
                const price = safeNumber(item.price);
                const img =
                  item?.image ||
                  item?.images?.[0] ||
                  getCategoryFallback(item?.category);

                return (
                  <div
                    key={item.id || item._id || `order-item-${index}`}
                    className="flex items-center gap-3"
                  >
                    <SafeImage
                      src={img}
                      alt={item?.title || "Product"}
                      wrapperClassName="w-14 h-14 rounded-lg shrink-0"
                      className="w-14 h-14 object-cover rounded-lg"
                    />

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {item?.title || item?.name || "Product"}
                      </p>

                      <p className="text-xs text-gray-500">
                        Qty: {quantity}
                      </p>
                    </div>

                    <p className="text-sm font-medium">
                      {formatPrice(price * quantity)}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Tracking Timeline */}
            {!isCancelled ? (
              <div className="mt-6 mb-8 px-2">
                <div className="relative flex justify-between">
                  <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -translate-y-1/2 z-0" />

                  <div
                    className="absolute top-1/2 left-0 h-0.5 bg-black -translate-y-1/2 z-0 transition-all duration-1000"
                    style={{ width: progressWidth }}
                  />

                  {TRACKING_STEPS.map((step) => {
                    const stepIdx = ORDER_FLOW.indexOf(step.id);
                    const isActive = stepIdx <= currentIdx;

                    return (
                      <div
                        key={step.id}
                        className="relative z-10 flex flex-col items-center gap-2"
                      >
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors duration-500 bg-white ${isActive
                              ? "border-black text-black"
                              : "border-slate-200 text-slate-300"
                            }`}
                        >
                          {isActive ? (
                            <CheckCircle
                              size={12}
                              fill="currentColor"
                              className="text-white bg-black rounded-full"
                            />
                          ) : (
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                          )}
                        </div>

                        <span
                          className={`text-[10px] font-bold uppercase tracking-tighter ${isActive ? "text-black" : "text-slate-400"
                            }`}
                        >
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mt-6 mb-6 bg-red-50 text-red-600 border border-red-100 rounded-xl p-4 text-sm font-medium">
                This order has been cancelled.
              </div>
            )}

            {/* Shipment Details */}
            {hasTracking && (
              <div className="mb-6 bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex gap-4 items-center">
                  <div className="p-3 bg-white rounded-lg shadow-sm">
                    <Truck size={20} className="text-slate-600" />
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Courier: {shipment.courierName || "Standard"}
                    </p>

                    <p className="text-xs font-black text-slate-900 font-mono tracking-tighter">
                      Tracking ID: {shipment.awbCode}
                    </p>

                    {shipment.estimatedDelivery && (
                      <p className="text-[10px] text-slate-500 mt-1">
                        Estimated delivery: {safeDate(shipment.estimatedDelivery)}
                      </p>
                    )}
                  </div>
                </div>

                {trackingUrl && isValidUrl(trackingUrl) && (
                  <a
                    href={trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full md:w-auto px-6 py-2.5 bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:shadow-xl active:scale-95 transition-all text-center"
                  >
                    Track Live
                  </a>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-between items-center mt-4 pt-4 border-t">
              <p className="font-bold text-lg">
                Total: {formatPrice(getDisplayTotal(order))}
              </p>

              <button
                type="button"
                onClick={() => handleOrderDetails(order)}
                className="flex items-center gap-1 text-sm font-bold text-slate-900 hover:underline"
              >
                Order Details <ChevronRight size={16} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
