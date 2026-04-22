import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../api/client";
import { mapOrder } from "../api/dynamicMapper";
import {
  ArrowRight,
  Check,
  Copy,
  ShoppingBag,
  Truck,
  Loader2,
  Package,
} from "lucide-react";
import { formatPrice } from "../utils/format";
import { motion } from "framer-motion";

/* ---------------- HEADER ---------------- */
const SuccessHeader = () => (
  <div className="text-center space-y-3">
    <div className="h-14 w-14 bg-green-500 rounded-full flex items-center justify-center mx-auto">
      <Check className="text-white" size={26} />
    </div>
    <h1 className="text-2xl font-semibold">
      Order Placed Successfully 🎉
    </h1>
    <p className="text-sm text-gray-500">
      Thank you! Your order has been confirmed
    </p>
  </div>
);

/* ---------------- ORDER ID ---------------- */
const OrderId = ({ id }) => {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopied(true);
    toast.success("Order ID copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-lg">
      <span className="text-sm">Order ID:</span>
      <span className="font-medium">
        #{id?.slice(-6)}
      </span>
      <button onClick={copy}>
        {copied ? (
          <Check size={14} />
        ) : (
          <Copy size={14} />
        )}
      </button>
    </div>
  );
};

/* ---------------- ORDER CARD ---------------- */
const OrderCard = ({ order }) => {
  return (
    <div className="w-full bg-white border rounded-xl p-5 space-y-4">
      {/* Items */}
      {order?.products?.map((p, i) => (
        <div key={i} className="flex gap-3 items-center">
          <img
            src={p.image || "/placeholder.png"}
            alt={p.title || "Product"}
            className="w-14 h-14 object-cover rounded-lg"
          />

          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">
              {p.title || "Product"}
            </p>
            <p className="text-xs text-gray-500">
              Qty: {p.quantity || 1}
            </p>
          </div>

          <p className="text-sm font-medium">
            {formatPrice(p.price || 0)}
          </p>
        </div>
      ))}

      {/* Summary */}
      <div className="border-t pt-3 space-y-2 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>
            {formatPrice(order.subtotal || 0)}
          </span>
        </div>

        {order.discount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Discount</span>
            <span>
              -{formatPrice(order.discount)}
            </span>
          </div>
        )}

        <div className="flex justify-between">
          <span>Tax</span>
          <span>{formatPrice(order.gst || 0)}</span>
        </div>

        <div className="flex justify-between">
          <span>Delivery</span>
          <span>
            {order.delivery > 0
              ? formatPrice(order.delivery)
              : "Free"}
          </span>
        </div>

        <div className="flex justify-between font-semibold text-base border-t pt-2">
          <span>Total</span>
          <span>{formatPrice(order.total || 0)}</span>
        </div>
      </div>
    </div>
  );
};

/* ---------------- ACTION BUTTONS ---------------- */
const Actions = ({ navigate }) => (
  <div className="flex flex-col sm:flex-row gap-3 w-full">
    <button
      onClick={() => navigate("/")}
      className="flex-1 h-12 bg-black text-white rounded-lg flex items-center justify-center gap-2"
    >
      Continue Shopping <ArrowRight size={16} />
    </button>

    <button
      onClick={() => navigate("/orders")}
      className="flex-1 h-12 border rounded-lg flex items-center justify-center gap-2"
    >
      View Orders
    </button>
  </div>
);

/* ---------------- MAIN ---------------- */
export default function OrderSuccess() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchOrder = async () => {
      try {
        const res = await api.get(`/orders/${id}`);
        const mapped = mapOrder(res);

        if (mounted) setOrder(mapped);
      } catch {
        toast.error("Unable to load order details");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchOrder();

    return () => {
      mounted = false;
    };
  }, [id]);

  /* ---------------- LOADING ---------------- */
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin" />
        <p className="text-sm text-gray-500">
          Loading order...
        </p>
      </div>
    );
  }

  /* ---------------- ERROR ---------------- */
  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
        <Package size={40} className="text-gray-300 mb-3" />
        <h2 className="text-xl font-semibold">
          Order not found
        </h2>
        <p className="text-gray-500 mb-4">
          We couldn’t find your order details
        </p>
        <button
          onClick={() => navigate("/")}
          className="px-6 py-3 bg-black text-white rounded-lg"
        >
          Go Home
        </button>
      </div>
    );
  }

  /* ---------------- UI ---------------- */
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-gray-50">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full max-w-xl space-y-6"
      >
        <SuccessHeader />

        <OrderId id={order.id} />

        <OrderCard order={order} />

        <Actions navigate={navigate} />

        {/* Trust */}
        <div className="flex justify-center gap-6 text-xs text-gray-500 pt-4">
          <div className="flex items-center gap-1">
            <ShoppingBag size={14} /> Secure checkout
          </div>
          <div className="flex items-center gap-1">
            <Truck size={14} /> Fast delivery
          </div>
        </div>
      </motion.div>
    </div>
  );
}