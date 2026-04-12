import { useState, useEffect } from "react";
import { api } from "../../api/client";
import toast from "react-hot-toast";
import { ShoppingBag, Search, Filter, ShieldCheck, User as UserIcon, Zap, CheckCircle, Clock, Truck, XCircle } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { mapOrder } from "../../api/dynamicMapper";

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setselectedOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [processingPayment, setProcessingPayment] = useState(false);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const data = await api.get("/admin/orders");
      // Log removed for production
      const mapped = Array.isArray(data) ? data.map(mapOrder) : [];
      setOrders(mapped);
    } catch (err) {
      console.error("ORDERS FETCH ERROR:", err.response?.data || err.message);
      toast.error("Failed to sync orders manifest");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, []);

  const updateStatus = async (id, status) => {
    // Log removed for production(`[Admin] Updating order ${id} to ${status}`);
    
    // Optimistic UI Update
    const previousOrders = [...orders];
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: status } : o))
    );

    try {
      await api.put(`/admin/orders/${id}/status`, {
        status: status,
      });
      toast.success(`Order ${status.toUpperCase()} Successfully`);
    } catch (err) {
      console.error("STATUS UPDATE ERROR:", err.response?.data || err.message);
      toast.error("Failed to update status");
      // Rollback on failure
      setOrders(previousOrders);
    }
  };

  const handleViewDetails = async (id) => {
    try {
      toast.loading("Fetching Order Manifest...", { id: "viewing" });
      const data = await api.get(`/orders/${id}`);
      setselectedOrder(mapOrder(data?.data || data));
      toast.success("Details Loaded", { id: "viewing" });
    } catch (err) {
      console.error("VIEW ERROR:", err);
      toast.error("Failed to load full manifest", { id: "viewing" });
    }
  };

  const handleDownloadInvoice = async (orderId) => {
    try {
      toast.loading("Generating Professional Invoice...", { id: "downloading" });
      const res = await api.get(`/orders/${orderId}/invoice?t=${Date.now()}`, {
        responseType: "blob",
      });
      
      // Step 3 fix: Precise blob-to-PDF download
      const url = window.URL.createObjectURL(new Blob([res], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `invoice-${orderId.slice(-8).toUpperCase()}.pdf`);
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success("Invoice Downloaded Successfully", { id: "downloading" });
    } catch (err) {
      let message = "Failed to generate or download invoice.";
      
      // Axios error handling for Blobs
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const errorData = JSON.parse(text);
          message = errorData.message || message;
        } catch (decodeErr) {
          console.error("Failed to decode error blob:", decodeErr);
        }
      } else if (err.message) {
        message = err.message;
      }
      
      console.error("Download Error Details:", err);
      toast.error(message, { id: "downloading" });
    }
  };

  const handleUpdatePaymentStatus = async (id, status) => {
    console.log(`[DEBUG] handleUpdatePaymentStatus triggered for order: ${id}`);
    if (status !== "PAID") {
      console.warn(`[DEBUG] Aborting: status ${status} is not 'PAID'`);
      return;
    }
    
    // Save state for rollback
    const previousOrders = [...orders];
    const previousSelected = selectedOrder ? { ...selectedOrder } : null;

    try {
      setProcessingPayment(true);
      toast.loading("Verifying Purchase...", { id: "payment" });
      
      // HIGH-RELIABILITY HAMMER ROUTE: Uses JSON body to bypass URL segment mapping issues
      // This solves the 404 error seen in the /pay endpoint logs
      const res = await api.put("/admin/pay", { orderId: id });
      
      // Sync with high-fidelity server response
      const serverOrder = res.data || res;
      const updatedOrder = mapOrder(serverOrder);

      // Instant UI Update
      setOrders(prev => prev.map(o => o.id === id ? updatedOrder : o));
      if (selectedOrder?.id === id) setselectedOrder(updatedOrder);
      
      toast.success("Transaction Marked as PAID", { id: "payment" });
    } catch (err) {
      console.error("PAYMENT SYNC FAILURE:", err);
      toast.error(err.response?.data?.message || "Verify failure - Check Admin Auth", { id: "payment" });
      
      // Rollback to maintain integrity
      setOrders(previousOrders);
      if (previousSelected) setselectedOrder(previousSelected);
    } finally {
      setProcessingPayment(false);
    }
  };

  const statusStyles = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "delivered") return "bg-green-100 text-green-700 border-green-200";
    if (s === "shipped") return "bg-blue-100 text-blue-700 border-blue-200";
    if (s === "confirmed") return "bg-indigo-100 text-indigo-700 border-indigo-200";
    if (s === "placed") return "bg-gray-100 text-gray-700 border-gray-200";
    if (s === "cancelled") return "bg-red-100 text-red-700 border-red-200";
    return "bg-gray-100 text-gray-700";
  };

  const filteredOrders = Array.isArray(orders) ? orders.filter(o => 
    o.id?.toLowerCase().includes(search.toLowerCase()) || 
    o.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
    o.products?.[0]?.title?.toLowerCase().includes(search.toLowerCase())
  ) : [];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
             <ShoppingBag size={18} className="text-gray-900" />
             <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Purchase management</span>
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight uppercase">Purchases</h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-white px-4 py-2 rounded-xl shadow-sm border flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">System Live</span>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="relative w-full lg:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            placeholder="Search purchase ID, customer, items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm focus:bg-white focus:border-gray-900 outline-none transition-all"
          />
        </div>
        
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
              <Zap size={14} className="text-indigo-500" /> {filteredOrders.length} Total Records
           </div>
           <button className="flex items-center gap-2 text-xs font-bold text-gray-900 hover:text-indigo-600 uppercase tracking-widest transition-all">
              <Filter size={14} /> Filter Reports
           </button>
        </div>
      </div>

      {/* ORDERS TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            {[1,2,3,4,5].map((i) => (
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
                  {/* TASK 3: SAFE RENDER GUARD */}
                  {Array.isArray(filteredOrders) && filteredOrders.length > 0 ? (
                    filteredOrders.map((order) => (
                       <tr key={order.id} className="hover:bg-gray-50/50 transition-colors group">
                        {/* ID */}
                        <td className="px-6 py-4">
                           <span className="text-xs font-black text-gray-900 uppercase">
                             #{order.id?.slice(-6).toUpperCase()}
                           </span>
                           <p className="text-[10px] text-gray-400 font-medium">
                             {new Date(order.createdAt).toLocaleDateString()}
                           </p>
                        </td>

                        {/* PRODUCT COLUMN */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={order.products?.[0]?.image || '/placeholder.png'}
                              className="w-10 h-10 rounded-lg object-cover border bg-white shadow-sm"
                            />
                            <div className="max-w-[150px]">
                              <p className="text-sm font-bold text-gray-800 truncate">
                                {order.products?.[0]?.title || "Product"}
                              </p>
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                Qty: {order.products?.[0]?.quantity || 1}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* ADDRESS COLUMN */}
                        <td className="px-6 py-4">
                          <div className="text-[11px] text-gray-600 max-w-[200px] leading-relaxed">
                            <span className="font-black text-gray-900 block truncate uppercase">{order.user?.name}</span>
                            <span className="truncate block opacity-80 italic">{order.address?.city ? `${order.address.city}, ${order.address.state || ''}` : typeof order.address === 'string' ? order.address : "No address"}</span>
                          </div>
                        </td>

                        {/* PAYMENT COLUMN */}
                        <td className="px-6 py-4">
                          {order.paymentMethod === "COD" || order.paymentMethod === "cod" ? (
                            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-orange-50 text-orange-600 border border-orange-100 uppercase tracking-tighter">
                              COD
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 uppercase tracking-tighter">
                              Online
                            </span>
                          )}
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black tracking-tight uppercase shadow-sm ${
                              (order.paymentStatus || "").toUpperCase() === "PAID" 
                                ? "bg-emerald-100 text-emerald-700 border border-emerald-200" 
                                : (order.paymentStatus || "").toUpperCase() === "FAILED"
                                ? "bg-rose-100 text-rose-700 border border-rose-200"
                                : "bg-amber-100 text-amber-700 border border-amber-200"
                            }`}>
                              {order.paymentStatus || "PENDING"}
                            </span>
                            <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest italic leading-none truncate">
                              ₹{order.total || 0}
                            </span>
                          </div>
                        </td>

                        {/* STATUS */}
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${statusStyles(order.status)}`}>
                            {order.status}
                          </span>
                        </td>

                        {/* VIEW BUTTON */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <select
                              value={order.status}
                              onChange={(e) => {
                                const newStatus = e.target.value;
                                updateStatus(order.id, newStatus);
                              }}
                              className="px-2 py-1.5 text-[10px] font-bold rounded-lg bg-white border border-gray-200 outline-none hover:border-gray-900 focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm cursor-pointer"
                            >
                              <option value="placed">PLACED</option>
                              <option value="confirmed">CONFIRMED</option>
                              <option value="shipped">SHIPPED</option>
                              <option value="delivered">DELIVERED</option>
                              <option value="cancelled">CANCELLED</option>
                            </select>
                            <button
                              onClick={() => handleViewDetails(order.id)}
                              className="text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 shadow-sm transition-all"
                            >
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-24 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <ShieldCheck size={48} className="text-gray-100" strokeWidth={1} />
                          <p className="text-sm font-black uppercase tracking-widest text-gray-300">No Order Found</p>
                        </div>
                      </td>
                    </tr>
                  )}
               </tbody>
            </table>
          </div>
        )}
      </div>

      {/* STEP 8: ORDER DETAILS DRAWER */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <div 
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
              onClick={() => setselectedOrder(null)}
            />
            
            <div className="absolute inset-y-0 right-0 max-w-md w-full bg-white shadow-2xl flex flex-col transform transition-transform duration-300">
              {/* DRAWER HEADER */}
              <div className="p-6 border-b flex items-center justify-between bg-gray-50">
                <div>
                  <h2 className="text-xl font-black text-gray-900 uppercase">Order Details</h2>
                  <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-widest">ID: {selectedOrder.id}</p>
                </div>
                <button 
                  onClick={() => setselectedOrder(null)}
                  className="p-2 hover:bg-white rounded-full transition-colors border border-transparent hover:border-gray-200"
                >
                  <XCircle size={24} className="text-gray-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
                {/* STEP 9: PRODUCTS LIST */}
                <section>
                  <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest mb-4">Product Manifest</h3>
                  <div className="space-y-4">
                    {(selectedOrder.products || []).map((item, i) => (
                      <div key={i} className="flex gap-4 p-3 rounded-xl border border-gray-100 bg-gray-50/30">
                        <img 
                          src={item.image || "/placeholder.png"} 
                          className="w-16 h-16 rounded-xl object-cover border bg-white shadow-sm" 
                        />
                        <div className="flex-1">
                          <p className="text-sm font-bold text-gray-900">
                            {item.title || "Product"}
                          </p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Qty: {item.quantity}</span>
                            <div className="flex flex-col items-end">
                               {item.topSize && item.bottomSize ? (
                                 <span className="text-[9px] font-black text-indigo-600 uppercase">Size: {item.topSize}(T) / {item.bottomSize}(B)</span>
                               ) : item.size ? (
                                 <span className="text-[9px] font-black text-indigo-600 uppercase">Size: {item.size}</span>
                               ) : null}
                               <span className="text-sm font-black text-indigo-600">₹{item.price}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* STEP 10: FULL ADDRESS */}
                <section>
                  <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest mb-4">Shipping Destination</h3>
                  <div className="p-4 rounded-xl border border-gray-100 bg-indigo-50/30">
                    <p className="text-sm font-bold text-gray-900 mb-2">
                       {selectedOrder.shippingAddress?.name || selectedOrder.user?.name || "N/A"}
                    </p>
                    <p className="text-xs text-gray-600 leading-relaxed font-medium">
                      {selectedOrder.shippingAddress ? 
                        `${selectedOrder.shippingAddress.address}, ${selectedOrder.shippingAddress.city}, ${selectedOrder.shippingAddress.state} - ${selectedOrder.shippingAddress.pincode}` : 
                        typeof selectedOrder.address === 'string' ? selectedOrder.address : "No address provided"
                      }<br />
                      <span className="font-bold text-gray-900 italic opacity-60">Status verified via metadata</span>
                    </p>
                    <div className="mt-4 pt-4 border-t border-gray-200/50">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Contact Module</p>
                      <p className="text-sm font-bold text-gray-900">
                        Phone: {selectedOrder.shippingAddress?.phone || selectedOrder.phone || "N/A"}
                      </p>
                    </div>
                  </div>
                </section>

                {/* STEP 11: PAYMENT INFO */}
                <section>
                  <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest mb-4">Fiscal Logic</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl border border-gray-100">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Method</p>
                      <span className="text-xs font-bold text-gray-900">{selectedOrder.paymentMethod}</span>
                    </div>
                    <div className="p-3 rounded-xl border border-gray-100 flex-1">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</p>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase ${selectedOrder.isPaid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {selectedOrder.isPaid ? "PAID" : "PENDING"}
                      </span>
                    </div>
                  </div>
                </section>

                {/* STEP 12: TOTAL */}
                <section className="p-6 bg-gray-900 rounded-2xl text-white shadow-xl">
                   <div className="flex justify-between items-center mb-2 opacity-60">
                      <span className="text-[10px] font-black uppercase tracking-widest">Order Valuation</span>
                      <span className="text-sm font-bold">₹{selectedOrder.total || 0}</span>
                   </div>
                   <div className="flex justify-between items-center">
                      <span className="text-xs font-black uppercase tracking-widest">Grand Total</span>
                      <span className="text-2xl font-black italic tracking-tighter">₹{selectedOrder.total || 0}</span>
                   </div>
                </section>
              </div>

              {/* ACTION FOOTER */}
              <div className="p-6 border-t bg-gray-50 space-y-3">
                 { !selectedOrder.isPaid && (
                   <button 
                    disabled={processingPayment}
                    onClick={() => handleUpdatePaymentStatus(selectedOrder.id, "PAID")}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                   >
                     <ShieldCheck size={16} /> {processingPayment ? "Processing..." : "Verify & Mark as PAID"}
                   </button>
                 )}
                 <div className="flex gap-3">
                    <button 
                      onClick={() => setselectedOrder(null)}
                      className="flex-1 py-3 rounded-xl border border-gray-200 text-xs font-black uppercase tracking-widest text-gray-400 hover:bg-white hover:text-gray-900 transition-all"
                    >
                      Close Manifest
                    </button>
                    <button 
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
