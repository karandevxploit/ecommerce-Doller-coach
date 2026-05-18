import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
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
import SafeImage from "../components/ui/SafeImage";

/* ---------------- HELPERS ---------------- */
const getResponseData = (response) => response?.data?.data || response?.data || response;

const safeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const getOrderDisplayId = (order = {}) => {
  const invoice = String(order?.invoiceNumber || "").trim();
  if (invoice && invoice.toUpperCase() !== "N/A") return invoice;

  const raw = String(order?.orderNumber || order?.id || order?._id || "").trim();
  return raw ? `ORD-${raw.slice(-8).toUpperCase()}` : "";
};
const DELIVERY_FEE = 40;
const COD_FEE = 50;

const getOrderList = (response) => {
  const data = getResponseData(response);

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.orders)) return data.orders;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;

  return [];
};

/* ---------------- HEADER ---------------- */
const SuccessHeader = () => (
  <div className="text-center space-y-3">
    <div className="h-14 w-14 bg-green-500 rounded-full flex items-center justify-center mx-auto">
      <Check className="text-white" size={26} />
    </div>

    <h1 className="text-2xl font-semibold">
      Order Placed Successfully
    </h1>

    <p className="text-sm text-gray-500">
      Thank you! Your order has been confirmed
    </p>
  </div>
);

/* ---------------- ORDER ID ---------------- */
const OrderId = ({ displayId, copyValue }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!copyValue && !displayId) return;

    try {
      const value = String(copyValue || displayId);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setCopied(true);
      toast.success("Order ID copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Unable to copy Order ID");
    }
  };

  if (!displayId) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-gray-100 px-4 py-2 rounded-lg">
      <span className="text-sm">Order ID:</span>

      <span className="font-medium">
        {displayId}
      </span>

      <button type="button" onClick={copy} aria-label="Copy order ID">
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
};

/* ---------------- ORDER CARD ---------------- */
const OrderCard = ({ order }) => {
  const products = Array.isArray(order?.products) ? order.products : [];

  const subtotal =
    safeNumber(order?.subtotal) ||
    safeNumber(order?.charges?.subtotal) ||
    products.reduce((acc, product) => {
      const quantity = Math.max(1, safeNumber(product?.quantity, 1));
      return acc + safeNumber(product?.price) * quantity;
    }, 0);

  const discount = safeNumber(order?.discount || order?.charges?.discount);
  const gst = safeNumber(order?.gst ?? order?.gstAmount ?? order?.tax ?? order?.charges?.tax);
  const gstPercent = safeNumber(order?.gstPercent ?? order?.charges?.gstPercent, 18);
  const delivery = safeNumber(order?.delivery ?? order?.deliveryFee ?? order?.charges?.delivery, DELIVERY_FEE) || DELIVERY_FEE;
  const isCod = String(order?.paymentMethod || "COD").toUpperCase() === "COD";
  const codFee = isCod ? Math.max(safeNumber(order?.codFee ?? order?.charges?.codFee), COD_FEE) : 0;
  const total = subtotal + gst + delivery + codFee - discount;

  return (
    <div className="w-full bg-white border rounded-xl p-5 space-y-4">
      {/* Items */}
      {products.map((product, index) => {
        const quantity = Math.max(1, safeNumber(product?.quantity, 1));
        const price = safeNumber(product?.price);

        return (
          <div
            key={product?.id || product?._id || `order-product-${index}`}
            className="flex gap-3 items-center"
          >
            <SafeImage
              src={product?.image || product?.images?.[0]}
              alt={product?.title || product?.name || "Product"}
              wrapperClassName="w-14 h-14 rounded-lg shrink-0"
              className="w-14 h-14 object-cover rounded-lg"
            />

            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">
                {product?.title || product?.name || "Product"}
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

      {/* Summary */}
      <div className="border-t pt-3 space-y-2 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatPrice(subtotal)}</span>
        </div>

        {discount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Discount</span>
            <span>-{formatPrice(discount)}</span>
          </div>
        )}

        <div className="flex justify-between">
          <span>GST ({gstPercent}%)</span>
          <span>{formatPrice(gst)}</span>
        </div>

        <div className="flex justify-between">
          <span>Delivery</span>
          <span>{formatPrice(delivery)}</span>
        </div>

        {codFee > 0 && (
          <div className="flex justify-between">
            <span>COD Fee</span>
            <span>{formatPrice(codFee)}</span>
          </div>
        )}

        <div className="flex justify-between font-semibold text-base border-t pt-2">
          <span>Total</span>
          <span>{formatPrice(total)}</span>
        </div>
      </div>
    </div>
  );
};

/* ---------------- ACTION BUTTONS ---------------- */
const Actions = ({ navigate }) => (
  <div className="flex flex-col sm:flex-row gap-3 w-full">
    <button
      type="button"
      onClick={() => navigate("/collection")}
      className="flex-1 h-12 bg-black text-white rounded-lg flex items-center justify-center gap-2"
    >
      Continue Shopping <ArrowRight size={16} />
    </button>

    <button
      type="button"
      onClick={() => navigate("/my-orders")}
      className="flex-1 h-12 border rounded-lg flex items-center justify-center gap-2"
    >
      View Orders
    </button>
  </div>
);

/* ---------------- MAIN ---------------- */
export default function OrderSuccess() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const stateOrder = location.state?.order || null;
  const stateOrderId = location.state?.orderId || stateOrder?.id || stateOrder?._id || null;
  const orderId = id || stateOrderId;

  const [order, setOrder] = useState(stateOrder ? mapOrder(stateOrder) : null);
  const [loading, setLoading] = useState(!stateOrder);

  useEffect(() => {
    let mounted = true;

    const fetchLatestOrder = async () => {
      const res = await api.get("/orders/my");
      const list = getOrderList(res);

      if (!list.length) return null;

      return list
        .slice()
        .sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime()
        )[0];
    };

    const fetchOrder = async () => {
      if (stateOrder) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        let rawOrder = null;

        if (orderId) {
          const res = await api.get(`/orders/${orderId}`);
          rawOrder = getResponseData(res);
        } else {
          rawOrder = await fetchLatestOrder();
        }

        const mapped = rawOrder ? mapOrder(rawOrder) : null;

        if (mounted) {
          setOrder(mapped);
        }
      } catch {
        if (mounted) {
          toast.error("Unable to load order details");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchOrder();

    return () => {
      mounted = false;
    };
  }, [orderId, stateOrder]);

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
          type="button"
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

        <OrderId
          displayId={getOrderDisplayId(order)}
          copyValue={order.id || order._id || getOrderDisplayId(order)}
        />

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
