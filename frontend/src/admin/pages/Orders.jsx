import { useState, useEffect, useCallback, useMemo } from "react";
import { api, isCancelledRequest } from "../../api/client";
import toast from "react-hot-toast";
import {
  ShoppingBag,
  Search,
  Filter,
  ShieldCheck,
  Zap,
  Clock,
  XCircle,
  CheckCircle2,
} from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { mapOrder } from "../../api/dynamicMapper";
import { useSafeInterval } from "../../hooks/useSafeInterval";
import SafeImage from "../../components/ui/SafeImage";

const getOrderList = (responseData) => {
  if (Array.isArray(responseData)) return responseData;
  if (Array.isArray(responseData?.data)) return responseData.data;
  if (Array.isArray(responseData?.data?.orders)) return responseData.data.orders;
  if (Array.isArray(responseData?.data?.items)) return responseData.data.items;
  if (Array.isArray(responseData?.orders)) return responseData.orders;
  if (Array.isArray(responseData?.items)) return responseData.items;
  return [];
};

const unwrapPayload = (responseData) => {
  return responseData?.data || responseData?.order || responseData || {};
};

const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const GST_PERCENT = 18;
const DELIVERY_FEE = 40;
const COD_FEE = 50;

const getOrderCharges = (order = {}) => {
  const products = Array.isArray(order.products) ? order.products : [];
  const computedSubtotal = products.reduce((sum, item) => {
    const quantity = Math.max(1, safeNumber(item?.quantity, 1));
    return sum + safeNumber(item?.price) * quantity;
  }, 0);
  const subtotal = safeNumber(order.subtotal, computedSubtotal);
  const discount = safeNumber(order.discount);
  const gstPercent = safeNumber(order.gstPercent, GST_PERCENT);
  const gst = safeNumber(order.gst, Math.round(subtotal * (gstPercent / 100)));
  const delivery = safeNumber(order.delivery, DELIVERY_FEE) || DELIVERY_FEE;
  const isCod = String(order.paymentMethod || "COD").toUpperCase() === "COD";
  const codFee = isCod ? Math.max(safeNumber(order.codFee), COD_FEE) : 0;
  const total = subtotal - discount + gst + delivery + codFee;
  return { subtotal, discount, gstPercent, gst, delivery, codFee, total };
};

const safeDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
};

const isCancelError = (err) => {
  return (
    isCancelledRequest?.(err) ||
    err?.name === "CanceledError" ||
    err?.name === "AbortError" ||
    err?.code === "ERR_CANCELED"
  );
};

const normalizeOrder = (raw, index = 0) => {
  try {
    const mapped = mapOrder(raw || {});
    const id = mapped?.id || raw?._id || raw?.id || `order-${index}`;

    return {
      ...mapped,
      id,
      raw,
      status: mapped?.status || raw?.status || "placed",
      paymentStatus: mapped?.paymentStatus || raw?.paymentStatus || "PENDING",
      paymentMethod: mapped?.paymentMethod || raw?.paymentMethod || "COD",
      products: Array.isArray(mapped?.products) ? mapped.products : [],
      user: mapped?.user || raw?.user || {},
      address: mapped?.address || raw?.address || raw?.shippingAddress || null,
      shippingAddress: mapped?.shippingAddress || raw?.shippingAddress || null,
      subtotal: safeNumber(mapped?.subtotal ?? raw?.subtotal),
      discount: safeNumber(mapped?.discount ?? raw?.discount),
      delivery: safeNumber(mapped?.delivery ?? raw?.delivery ?? raw?.deliveryFee),
      codFee: safeNumber(mapped?.codFee ?? raw?.codFee),
      gst: safeNumber(mapped?.gst ?? raw?.gst ?? raw?.gstAmount),
      gstPercent: safeNumber(mapped?.gstPercent ?? raw?.gstPercent, GST_PERCENT),
      total: getOrderCharges({ ...mapped, ...raw }).total,
      createdAt: mapped?.createdAt || raw?.createdAt || raw?.updatedAt || null,
      isPaid:
        mapped?.isPaid ??
        raw?.isPaid ??
        String(mapped?.paymentStatus || raw?.paymentStatus || "").toUpperCase() === "PAID",
    };
  } catch (err) {
    console.error("ORDER_MAP_ERROR:", err);

    return {
      id: raw?._id || raw?.id || `order-${index}`,
      raw,
      status: raw?.status || "placed",
      paymentStatus: raw?.paymentStatus || "PENDING",
      paymentMethod: raw?.paymentMethod || "COD",
      products: Array.isArray(raw?.products) ? raw.products : [],
      user: raw?.user || {},
      address: raw?.address || raw?.shippingAddress || null,
      shippingAddress: raw?.shippingAddress || null,
      subtotal: safeNumber(raw?.subtotal),
      discount: safeNumber(raw?.discount),
      delivery: safeNumber(raw?.delivery ?? raw?.deliveryFee),
      codFee: safeNumber(raw?.codFee),
      gst: safeNumber(raw?.gst ?? raw?.gstAmount),
      gstPercent: safeNumber(raw?.gstPercent, GST_PERCENT),
      total: getOrderCharges(raw).total,
      createdAt: raw?.createdAt || null,
      isPaid: Boolean(raw?.isPaid),
    };
  }
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [processingPayment, setProcessingPayment] = useState(false);
  const [confirmingId, setConfirmingId] = useState(null);

  const fetchOrders = useCallback(async (signal) => {
    try {
      setLoading(true);

      const res = await api.get("/admin/orders", {
        signal,
        params: { page: 1, limit: 20 },
        timeout: 20000,
      });
      const rawPayload = getOrderList(res?.data);
      const mapped = rawPayload.map((item, index) => normalizeOrder(item, index));

      setOrders(mapped);
    } catch (err) {
      if (isCancelError(err)) return;

      console.error("ORDERS_FETCH_ERROR:", err?.response?.data || err?.message);
      toast.error(err?.response?.data?.message || "Failed to sync orders manifest");
      setOrders([]);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchOrders(controller.signal);

    return () => controller.abort();
  }, [fetchOrders]);

  useSafeInterval(() => {
    if (selectedOrder) return;
    return fetchOrders();
  }, 20000);

  const confirmOrder = async (id) => {
    if (!id || confirmingId) return;

    setConfirmingId(id);
    toast.loading("Confirming order and booking Shiprocket...", { id: "confirm-order" });

    try {
      const res = await api.post(`/admin/orders/${id}/confirm`);
      const updatedOrder = normalizeOrder(unwrapPayload(res?.data));

      setOrders((prev) =>
        prev.map((order) => (order.id === id ? { ...order, ...updatedOrder } : order))
      );

      if (selectedOrder?.id === id) {
        setSelectedOrder((prev) => (prev ? { ...prev, ...updatedOrder } : prev));
      }

      toast.success("Order confirmed and sent to Shiprocket", { id: "confirm-order" });
    } catch (err) {
      console.error("ORDER_CONFIRM_ERROR:", err?.response?.data || err?.message);
      toast.error(err?.response?.data?.message || "Shiprocket booking failed", {
        id: "confirm-order",
      });
      await fetchOrders();
    } finally {
      setConfirmingId(null);
    }
  };

  const handleViewDetails = async (id) => {
    if (!id) return;

    try {
      toast.loading("Fetching Order Manifest...", { id: "viewing" });

      let res;
      try {
        res = await api.get(`/admin/orders/${id}`);
      } catch (adminErr) {
        if (adminErr?.response?.status !== 404) throw adminErr;
        res = await api.get(`/orders/${id}`);
      }

      const payload = unwrapPayload(res?.data);
      setSelectedOrder(normalizeOrder(payload));
      toast.success("Details Loaded", { id: "viewing" });
    } catch (err) {
      if (isCancelError(err)) return;

      console.error("VIEW_ERROR:", err?.response?.data || err?.message);
      toast.error(err?.response?.data?.message || "Failed to load full manifest", {
        id: "viewing",
      });
    }
  };

  const handleDownloadInvoice = async (orderId) => {
    if (!orderId) return;

    try {
      toast.loading("Generating Professional Invoice...", { id: "downloading" });

      let res;
      try {
        res = await api.get(`/admin/orders/${orderId}/invoice?t=${Date.now()}`, {
          responseType: "blob",
        });
      } catch (adminErr) {
        if (adminErr?.response?.status !== 404) throw adminErr;
        res = await api.get(`/orders/${orderId}/invoice?t=${Date.now()}`, {
          responseType: "blob",
        });
      }

      const url = window.URL.createObjectURL(
        new Blob([res.data], { type: "application/pdf" })
      );

      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `invoice-${String(orderId).slice(-8).toUpperCase()}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Invoice Downloaded Successfully", { id: "downloading" });
    } catch (err) {
      let message = "Failed to generate or download invoice.";

      if (err?.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const errorData = JSON.parse(text);
          message = errorData.message || message;
        } catch {
          message = err?.message || message;
        }
      } else {
        message = err?.response?.data?.message || err?.message || message;
      }

      console.error("INVOICE_DOWNLOAD_ERROR:", err?.response?.data || err?.message);
      toast.error(message, { id: "downloading" });
    }
  };

  const handleUpdatePaymentStatus = async (id, status) => {
    if (!id || status !== "PAID" || processingPayment) return;

    const previousOrders = orders;
    const previousSelected = selectedOrder;

    try {
      setProcessingPayment(true);
      toast.loading("Verifying Purchase...", { id: "payment" });

      let res;
      try {
        res = await api.put("/admin/pay", { orderId: id });
      } catch (payErr) {
        if (payErr?.response?.status !== 404) throw payErr;
        res = await api.put(`/admin/orders/${id}/payment`, { paymentStatus: "PAID" });
      }

      const updatedOrder = normalizeOrder(unwrapPayload(res?.data));

      setOrders((prev) =>
        prev.map((order) => (order.id === id ? { ...order, ...updatedOrder } : order))
      );

      if (selectedOrder?.id === id) {
        setSelectedOrder((prev) => (prev ? { ...prev, ...updatedOrder } : prev));
      }

      toast.success("Transaction Marked as PAID", { id: "payment" });
    } catch (err) {
      console.error("PAYMENT_SYNC_FAILURE:", err?.response?.data || err?.message);
      toast.error(err?.response?.data?.message || "Verify failure - Check Admin Auth", {
        id: "payment",
      });

      setOrders(previousOrders);
      setSelectedOrder(previousSelected);
    } finally {
      setProcessingPayment(false);
    }
  };

  const statusStyles = (status) => {
    const value = String(status || "").toLowerCase();

    if (value === "delivered") return "bg-green-100 text-green-700 border-green-200";
    if (value === "shipped") return "bg-blue-100 text-blue-700 border-blue-200";
    if (value === "out_for_delivery") return "bg-cyan-100 text-cyan-700 border-cyan-200";
    if (value === "processing") return "bg-purple-100 text-purple-700 border-purple-200";
    if (value === "confirmed") return "bg-indigo-100 text-indigo-700 border-indigo-200";
    if (value === "placed") return "bg-gray-100 text-gray-700 border-gray-200";
    if (value === "cancelled") return "bg-red-100 text-red-700 border-red-200";

    return "bg-gray-100 text-gray-700 border-gray-200";
  };

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return orders;

    return orders.filter((order) => {
      const productTitle = order.products?.[0]?.title || "";

      return (
        String(order.id || "").toLowerCase().includes(q) ||
        String(order.user?.name || "").toLowerCase().includes(q) ||
        String(productTitle).toLowerCase().includes(q)
      );
    });
  }, [orders, search]);

  return (
    <div className="admin-shell space-y-5">
      <div className="admin-card p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShoppingBag size={18} className="text-gray-900" />
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Purchase management
            </span>
          </div>
          <h1 className="admin-heading">
            Purchases
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="surface-soft px-4 py-2 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
              System Live
            </span>
          </div>
        </div>
      </div>

      <div className="admin-card p-4 flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="relative w-full lg:w-96">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            size={16}
          />
          <input
            placeholder="Search purchase ID, customer, items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="control-input w-full pl-10 pr-4 py-2.5 text-sm"
          />
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
            <Zap size={14} className="text-indigo-500" /> {filteredOrders.length} Total Records
          </div>
          <button
            type="button"
            className="flex items-center gap-2 text-xs font-bold text-gray-900 hover:text-indigo-600 uppercase tracking-widest transition-all"
          >
            <Filter size={14} /> Filter Reports
          </button>
        </div>
      </div>

      <div className="admin-card overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b">
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Order ID</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Payment</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-50">
                {filteredOrders.length > 0 ? (
                  filteredOrders.map((order) => {
                    const product = order.products?.[0] || {};
                    const paymentStatus = String(order.paymentStatus || "PENDING").toUpperCase();
                    const shipmentStatus =
                      order.shipment_status ||
                      order.shipment?.status ||
                      order.shiprocket?.status ||
                      "";
                    const hasShipment =
                      Boolean(order.shipment?.shipmentId || order.shipment?.shipment_id) ||
                      Boolean(order.shiprocket?.shipmentId);
                    const normalizedStatus = String(order.status || "").toLowerCase();
                    const canConfirm =
                      normalizedStatus === "placed" ||
                      (normalizedStatus === "confirmed" && !hasShipment);

                    return (
                      <tr key={order.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <span className="text-xs font-black text-gray-900 uppercase">
                            #{String(order.id || "").slice(-6).toUpperCase()}
                          </span>
                          <p className="text-[10px] text-gray-400 font-medium">
                            {safeDate(order.createdAt)}
                          </p>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <SafeImage
                              src={product.image}
                              alt={product.title || "Product"}
                              wrapperClassName="w-10 h-10 rounded-lg border bg-white shadow-sm"
                              className="w-10 h-10 rounded-lg object-cover border bg-white shadow-sm"
                            />
                            <div className="max-w-[150px]">
                              <p className="text-sm font-bold text-gray-800 truncate">
                                {product.title || "Product"}
                              </p>
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                Qty: {product.quantity || 1}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="text-[11px] text-gray-600 max-w-[200px] leading-relaxed">
                            <span className="font-black text-gray-900 block truncate uppercase">
                              {order.user?.name || "N/A"}
                            </span>
                            <span className="truncate block opacity-80 italic">
                              {order.address?.city
                                ? `${order.address.city}, ${order.address.state || ""}`
                                : typeof order.address === "string"
                                  ? order.address
                                  : "No address"}
                            </span>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          {String(order.paymentMethod || "").toLowerCase() === "cod" ? (
                            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-orange-50 text-orange-600 border border-orange-100 uppercase tracking-tighter">
                              COD
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 uppercase tracking-tighter">
                              Online
                            </span>
                          )}

                          <div className="flex items-center gap-2 mt-1.5">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[9px] font-black tracking-tight uppercase shadow-sm ${paymentStatus === "PAID"
                                  ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                  : paymentStatus === "FAILED"
                                    ? "bg-rose-100 text-rose-700 border border-rose-200"
                                    : "bg-amber-100 text-amber-700 border border-amber-200"
                                }`}
                            >
                              {paymentStatus}
                            </span>
                            <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest italic leading-none truncate">
                              ₹{safeNumber(order.total).toLocaleString("en-IN")}
                            </span>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${statusStyles(order.status)}`}>
                            {order.status || "placed"}
                          </span>
                          {hasShipment && (
                            <p className="mt-1.5 text-[9px] font-black uppercase tracking-widest text-emerald-600">
                              Shiprocket {shipmentStatus || "booked"}
                            </p>
                          )}
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {canConfirm ? (
                              <button
                                type="button"
                                disabled={confirmingId === order.id}
                                onClick={() => confirmOrder(order.id)}
                                className="inline-flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm transition-all disabled:opacity-60"
                              >
                                <CheckCircle2 size={14} />
                                {confirmingId === order.id ? "Confirming" : "Confirm"}
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg bg-slate-100 text-slate-500 border border-slate-200">
                                <CheckCircle2 size={14} />
                                Confirmed
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleViewDetails(order.id)}
                              className="text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 shadow-sm transition-all"
                            >
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-24 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <ShieldCheck size={48} className="text-gray-100" strokeWidth={1} />
                        <p className="text-sm font-black uppercase tracking-widest text-gray-300">
                          No Order Found
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <div
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
              onClick={() => setSelectedOrder(null)}
            />

            <div className="absolute inset-y-0 right-0 max-w-md w-full bg-white shadow-2xl flex flex-col transform transition-transform duration-300">
              <div className="p-6 border-b flex items-center justify-between bg-gray-50">
                <div>
                  <h2 className="text-xl font-black text-gray-900 uppercase">Order Details</h2>
                  <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-widest">
                    ID: {selectedOrder.id}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="p-2 hover:bg-white rounded-full transition-colors border border-transparent hover:border-gray-200"
                >
                  <XCircle size={24} className="text-gray-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
                <section>
                  <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest mb-4">
                    Product Manifest
                  </h3>
                  <div className="space-y-4">
                    {(selectedOrder.products || []).map((item, index) => (
                      <div key={`${item?.id || item?._id || index}`} className="flex gap-4 p-3 rounded-xl border border-gray-100 bg-gray-50/30">
                        <SafeImage
                          src={item?.image}
                          alt={item?.title || "Product"}
                          wrapperClassName="w-16 h-16 rounded-xl border bg-white shadow-sm"
                          className="w-16 h-16 rounded-xl object-cover border bg-white shadow-sm"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-bold text-gray-900">
                            {item?.title || "Product"}
                          </p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest">
                              Qty: {item?.quantity || 1}
                            </span>
                            <div className="flex flex-col items-end">
                              {item?.topSize && item?.bottomSize ? (
                                <span className="text-[9px] font-black text-indigo-600 uppercase">
                                  Size: {item.topSize}(T) / {item.bottomSize}(B)
                                </span>
                              ) : item?.size ? (
                                <span className="text-[9px] font-black text-indigo-600 uppercase">
                                  Size: {item.size}
                                </span>
                              ) : null}
                              <span className="text-sm font-black text-indigo-600">
                                ₹{safeNumber(item?.price).toLocaleString("en-IN")}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest mb-4">
                    Shipping Destination
                  </h3>
                  <div className="p-4 rounded-xl border border-gray-100 bg-indigo-50/30">
                    <p className="text-sm font-bold text-gray-900 mb-2">
                      {selectedOrder.shippingAddress?.name || selectedOrder.user?.name || "N/A"}
                    </p>
                    <p className="text-xs text-gray-600 leading-relaxed font-medium">
                      {selectedOrder.shippingAddress
                        ? `${selectedOrder.shippingAddress.address || ""}, ${selectedOrder.shippingAddress.city || ""}, ${selectedOrder.shippingAddress.state || ""} - ${selectedOrder.shippingAddress.pincode || ""}`
                        : typeof selectedOrder.address === "string"
                          ? selectedOrder.address
                          : "No address provided"}
                      <br />
                      <span className="font-bold text-gray-900 italic opacity-60">
                        Status verified via metadata
                      </span>
                    </p>
                    <div className="mt-4 pt-4 border-t border-gray-200/50">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Contact Module
                      </p>
                      <p className="text-sm font-bold text-gray-900">
                        Phone: {selectedOrder.shippingAddress?.phone || selectedOrder.phone || "N/A"}
                      </p>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest mb-4">
                    Fiscal Logic
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl border border-gray-100">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                        Method
                      </p>
                      <span className="text-xs font-bold text-gray-900">
                        {selectedOrder.paymentMethod || "N/A"}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl border border-gray-100 flex-1">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                        Status
                      </p>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase ${selectedOrder.isPaid
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                          }`}
                      >
                        {selectedOrder.isPaid ? "PAID" : "PENDING"}
                      </span>
                    </div>
                  </div>
                </section>

                <section className="p-6 bg-gray-900 rounded-2xl text-white shadow-xl">
                  {(() => {
                    const charges = getOrderCharges(selectedOrder);

                    return (
                      <div className="space-y-2 mb-4 pb-4 border-b border-white/10 text-xs">
                        {[
                          ["Subtotal", charges.subtotal],
                          [`GST (${charges.gstPercent}%)`, charges.gst],
                          ["Delivery", charges.delivery],
                          ["COD Fee", charges.codFee],
                        ].map(([label, value]) => (
                          <div key={label} className="flex justify-between items-center opacity-75">
                            <span className="font-black uppercase tracking-widest">{label}</span>
                            <span className="font-bold">₹{safeNumber(value).toLocaleString("en-IN")}</span>
                          </div>
                        ))}
                        {charges.discount > 0 && (
                          <div className="flex justify-between items-center text-emerald-300">
                            <span className="font-black uppercase tracking-widest">Discount</span>
                            <span className="font-bold">-₹{charges.discount.toLocaleString("en-IN")}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  <div className="flex justify-between items-center mb-2 opacity-60">
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      Order Valuation
                    </span>
                    <span className="text-sm font-bold">
                      ₹{safeNumber(selectedOrder.total).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black uppercase tracking-widest">
                      Grand Total
                    </span>
                    <span className="text-2xl font-black italic tracking-tighter">
                      ₹{safeNumber(selectedOrder.total).toLocaleString("en-IN")}
                    </span>
                  </div>
                </section>
              </div>

              <div className="p-6 border-t bg-gray-50 space-y-3">
                {!selectedOrder.isPaid && (
                  <button
                    type="button"
                    disabled={processingPayment}
                    onClick={() => handleUpdatePaymentStatus(selectedOrder.id, "PAID")}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <ShieldCheck size={16} />{" "}
                    {processingPayment ? "Processing..." : "Verify & Mark as PAID"}
                  </button>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedOrder(null)}
                    className="flex-1 py-3 rounded-xl border border-gray-200 text-xs font-black uppercase tracking-widest text-gray-400 hover:bg-white hover:text-gray-900 transition-all"
                  >
                    Close Manifest
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadInvoice(selectedOrder.id)}
                    className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest shadow-md hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                  >
                    <Clock size={14} className="animate-pulse" /> Download Invoice
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
