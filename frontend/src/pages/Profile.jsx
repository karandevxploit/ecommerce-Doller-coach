import { useState, useEffect } from "react";
import { useAuthStore } from "../store";
import { api } from "../api/client";
import { LogOut, MapPin, Package, ShieldCheck, Zap, ArrowRight, User as UserIcon, Tag, ShoppingBag } from "lucide-react";
import { mapOrder } from "../api/dynamicMapper";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { staggerContainer, slideUp, fadeIn, scaleIn } from "../utils/motion";
import { ChevronRight } from "lucide-react";
import { getCategoryFallback } from "../utils/imageFallbacks";

export default function Profile() {
  const { user, logout, isAuthenticated } = useAuthStore();
  const [initials, setInitials] = useState("U");
  const [addresses, setAddresses] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addressForm, setAddressForm] = useState({ 
    name: "", 
    phone: "", 
    addressLine1: "", 
    city: "", 
    state: "", 
    pincode: "" 
  });

  useEffect(() => {
    if (user && user.name) {
      const value = user.name
        .split(" ")
        .map(n => n[0])
        .join("")
        .toUpperCase();
      setInitials(value);
    }

    // Global Fallback
    const handleError = (msg) => console.error("Account Engine Failure:", msg);
    window.onerror = handleError;
    return () => { window.onerror = null; };
  }, [user]);

  const handleUseLocation = () => {
    if (!navigator.geolocation) return toast.error("Geolocation not supported");
    
    setLoading(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const { latitude: lat, longitude: lng } = pos.coords;
        // Using OpenCage (User Suggestion) or Fallback
        const ocKey = import.meta.env.VITE_OPENCAGE_KEY;
        if (!ocKey) {
          toast.error("Add VITE_OPENCAGE_KEY for auto-location.");
          setLoading(false);
          return;
        }
        const res = await fetch(`https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lng}&key=${ocKey}`);
        const data = await res.json();
        const info = data.results?.[0]?.components;
        
        if (info) {
          setAddressForm(prev => ({
            ...prev,
            addressLine1: data.results[0].formatted || prev.addressLine1,
            city: info.city || info.town || info.village || prev.city,
            state: info.state || prev.state,
            pincode: info.postcode || prev.pincode
          }));
          toast.success("Coordinates Localized");
        } else {
          toast.error("Reverse Geocoding Failed");
        }
      } catch (err) {
        toast.error("Location Save Error");
      } finally {
        setLoading(false);
      }
    }, () => {
      setLoading(false);
      toast.error("Location Access Denied");
    });
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    const load = async () => {
      try {
        const [addr, ordRes] = await Promise.all([
          api.get("/auth/addresses"),
          api.get("/orders"),
        ]);
        setAddresses(Array.isArray(addr) ? addr : []);
        // Resolve path conflict: if backend returns { success, orders }, extract orders
        const rawOrders = ordRes?.orders || ordRes;
        const ordersData = Array.isArray(rawOrders) ? rawOrders.map(mapOrder) : [];
        setOrders(ordersData);
      } catch (err) {
        console.error("Orders sync failed:", err.message);
        toast.error("Error loading: Account Logs");
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isAuthenticated]);

  const saveAddress = async () => {
    if (!addressForm.addressLine1 || !addressForm.city || !addressForm.pincode) return toast.error("Required Product Missing");
    try {
      await api.post("/auth/addresses", addressForm);
      toast.success("Location Saved");
      const res = await api.get("/auth/addresses");
      setAddresses(Array.isArray(res) ? res : []);
      setAddressForm({ name: "", phone: "", addressLine1: "", city: "", state: "", pincode: "" });
    } catch (err) {
      toast.error(err?.response?.data?.message || "Save failure");
    }
  };

  if (!user || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="h-12 w-12 border-4 border-gray-50 border-t-[#1e3a8a] animate-spin rounded-full shadow-lg" />
        <p className="ml-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Synchronizing Account...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* TOP PROFILE CARD - ACCESS MANIFEST */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row items-center justify-between bg-white border border-gray-100 rounded-[2rem] p-8 mb-10 gap-6 shadow-sm"
      >
        <div className="flex items-center gap-6 text-center sm:text-left flex-col sm:flex-row">
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="w-20 h-20 rounded-3xl bg-[#0f172a] text-white flex items-center justify-center font-black text-2xl shadow-2xl"
          >
            {initials}
          </motion.div>
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-[#0f172a] uppercase tracking-tighter">{user?.name}</h1>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">{user?.email}</p>
          </div>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={logout}
          className="px-8 py-3.5 rounded-2xl bg-gray-50 border border-gray-100 text-[10px] font-black uppercase tracking-widest text-[#0f172a] hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all flex items-center gap-2"
        >
          <LogOut size={16} /> Sign Out
        </motion.button>
      </motion.div>

      {/* MAIN CONTENT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* PURCHASE HISTORY - THE ARCHIVE */}
        <div className="bg-white rounded-[2rem] border border-gray-100 p-8 space-y-6 shadow-sm">
          <div className="flex flex-col gap-2 pb-2">
            <div className="flex items-center gap-2">
              <Package size={18} className="text-[#0f172a]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">Transaction Registry</span>
            </div>
            <h2 className="text-2xl font-black text-[#0f172a] tracking-tighter uppercase">Purchase history</h2>
          </div>

          <motion.div 
            variants={staggerContainer(0.12)}
            initial="hidden"
            animate="visible"
            className="space-y-4 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar"
          >
            {orders?.length > 0 ? (
              orders.map((order, orderIdx) => (
                <motion.div 
                  key={order.id || `order-${orderIdx}`}
                  variants={slideUp}
                  whileHover={{ y: -4, transition: { duration: 0.3 } }}
                  className="border border-gray-100 rounded-[1.5rem] bg-gray-50/50 p-6 transition-all group overflow-hidden relative"
                >
                   <div className="absolute top-0 left-0 w-1 h-full bg-[#0f172a] opacity-0 group-hover:opacity-100 transition-opacity" />
                   
                  <div className="flex justify-between items-center border-b border-gray-100 pb-4 mb-4">
                    <span className="text-[10px] font-black text-[#0f172a] uppercase tracking-tight">MANIFEST ID: #{String(order.id).slice(-8).toUpperCase()}</span>
                    <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">{new Date(order.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                  </div>

                  <div className="space-y-4">
                    {order.products?.map((item, i) => (
                      <div key={`${order.id}-item-${i}`} className="flex gap-4 items-start bg-white p-4 rounded-2xl border border-gray-50 hover:border-gray-100 transition-colors">
                        <img 
                          src={item.image || (item.images && item.images[0]) || getCategoryFallback(item.category)} 
                          className="w-16 h-20 rounded-xl object-cover border border-gray-50 flex-shrink-0 grayscale-[0.2] group-hover:grayscale-0 transition-all duration-500" 
                          alt="product"
                        />
                        <div className="flex-1 min-w-0 flex flex-col justify-between h-20">
                          <div>
                            <div className="flex justify-between items-start mb-0.5">
                               <p className="text-xs font-black text-[#0f172a] truncate uppercase tracking-tight">{item.title}</p>
                               <span className="text-[9px] font-black text-[#0f172a] bg-gray-100 px-2 py-0.5 rounded leading-none uppercase tracking-widest">
                                 ₹{item.price}
                               </span>
                            </div>
                            <p className="text-[10px] text-gray-400 line-clamp-1 italic mb-1 uppercase tracking-tighter">
                               {item.description || "Precision engineered for excellence."}
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                             <div className="text-[8px] font-black text-gray-400 uppercase tracking-widest border border-gray-100 px-1.5 py-0.5 rounded">
                                Quantità: {item.quantity}
                             </div>
                             {item.topSize && item.bottomSize ? (
                                <div className="text-[8px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-50 px-1.5 py-0.5 rounded leading-none">
                                  Set: {item.topSize} / {item.bottomSize}
                                </div>
                             ) : item.size ? (
                                <div className="text-[8px] font-black text-gray-500 uppercase tracking-widest bg-gray-50 px-1.5 py-0.5 rounded leading-none">
                                  Size: {item.size}
                                </div>
                             ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between items-center">
                    <span className={`text-[9px] uppercase font-black tracking-[0.2em] px-3 py-1.5 rounded-full border ${
                      String(order.status).toLowerCase() === 'delivered' ? 'bg-green-50 text-green-700 border-green-100' :
                      String(order.status).toLowerCase() === 'cancelled' ? 'bg-red-50 text-red-700 border-red-100' :
                      'bg-[#0f172a] text-white border-transparent'
                    }`}>
                      {order.status}
                    </span>
                    <div className="text-right">
                       <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest leading-none mb-1">Total Authorized</p>
                       <p className="text-lg font-black text-[#0f172a] tracking-tighter leading-none">₹{order.totalAmount || order.totalPrice}</p>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="py-20 text-center bg-gray-50/50 rounded-[2rem] border border-dashed border-gray-100">
                <Package size={40} className="mx-auto text-gray-200 mb-4" />
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.3em]">Registry Empty</p>
              </div>
            )}
          </motion.div>
        </div>

        {/* LOCALIZATION & ACCESS SECTION */}
        <div className="bg-white rounded-[2rem] border border-gray-100 p-8 space-y-6 shadow-sm h-fit">
          <div className="flex flex-col gap-2 pb-2">
            <div className="flex items-center gap-2">
              <MapPin size={18} className="text-[#0f172a]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">Localization Hub</span>
            </div>
            <div className="flex items-center justify-between gap-4">
               <h2 className="text-2xl font-black text-[#0f172a] tracking-tighter uppercase leading-none">Shipping</h2>
               <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={handleUseLocation}
                className="px-4 py-2 bg-[#0f172a] text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-black transition-all flex items-center gap-2"
              >
                <Zap size={10} fill="white" /> Auto Locate
              </motion.button>
            </div>
          </div>

          <div className="space-y-4">
            {addresses.map((a, idx) => (
              <motion.div
                key={a._id || `addr-${idx}`}
                whileHover={{ x: 4 }}
                className="p-5 bg-gray-50/50 border border-gray-100 hover:border-gray-200 rounded-[1.5rem] transition-all relative group"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="space-y-1">
                    <p className="text-xs font-black text-[#0f172a] uppercase tracking-tight leading-none">{a.name}</p>
                    <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest leading-none">{a.phone}</p>
                  </div>
                  <ChevronRight size={14} className="text-gray-200 group-hover:text-[#0f172a] transition-colors" />
                </div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider leading-relaxed">
                  {a.addressLine1}, {a.city}, {a.state} - {a.pincode}
                </p>
              </motion.div>
            ))}
          </div>

          {/* ADD NEW ADDRESS FORM - THE TERMINAL */}
          <div className="pt-8 border-t border-gray-50 space-y-6">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-[#0f172a] uppercase tracking-widest leading-none">New Entry</span>
              <div className="flex-1 h-px bg-gray-50" />
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                   <label className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-300 px-1">Full Name</label>
                   <input
                    placeholder="CLIENT NAME"
                    value={addressForm.name}
                    onChange={(e) => setAddressForm({ ...addressForm, name: e.target.value })}
                    className="w-full bg-gray-50/30 border border-gray-100 rounded-2xl px-5 py-4 text-xs font-bold focus:ring-2 focus:ring-[#0f172a] outline-none transition-all placeholder:text-gray-200 uppercase tracking-widest"
                  />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-300 px-1">Access Phone</label>
                   <input
                    placeholder="+91"
                    value={addressForm.phone}
                    onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                    className="w-full bg-gray-50/30 border border-gray-100 rounded-2xl px-5 py-4 text-xs font-bold focus:ring-2 focus:ring-[#0f172a] outline-none transition-all placeholder:text-gray-200 uppercase tracking-widest"
                  />
                 </div>
              </div>

              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-300 px-1">Manifest Destination</label>
                <input
                  placeholder="STREET, BUILDING, SECTOR"
                  className="w-full bg-gray-50/30 border border-gray-100 rounded-2xl px-5 py-4 text-xs font-bold focus:ring-2 focus:ring-[#0f172a] outline-none transition-all placeholder:text-gray-200 uppercase tracking-widest"
                  value={addressForm.addressLine1}
                  onChange={(e) => setAddressForm({ ...addressForm, addressLine1: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                 <div className="space-y-1 col-span-1">
                    <label className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-300 px-1">City</label>
                    <input
                      placeholder="CITY"
                      value={addressForm.city}
                      onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                      className="w-full bg-gray-50/30 border border-gray-100 rounded-2xl px-5 py-4 text-xs font-bold focus:ring-2 focus:ring-[#0f172a] outline-none transition-all placeholder:text-gray-200 uppercase tracking-widest"
                    />
                 </div>
                 <div className="space-y-1 col-span-1">
                    <label className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-300 px-1">State</label>
                    <input
                      placeholder="ST"
                      value={addressForm.state}
                      onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                      className="w-full bg-gray-50/30 border border-gray-100 rounded-2xl px-5 py-4 text-xs font-bold focus:ring-2 focus:ring-[#0f172a] outline-none transition-all placeholder:text-gray-200 uppercase tracking-widest"
                    />
                 </div>
                 <div className="space-y-1 col-span-1">
                    <label className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-300 px-1">Pincode</label>
                    <input
                      placeholder="XXXXXX"
                      value={addressForm.pincode}
                      onChange={(e) => setAddressForm({ ...addressForm, pincode: e.target.value })}
                      className="w-full bg-gray-50/30 border border-gray-100 rounded-2xl px-5 py-4 text-xs font-bold focus:ring-2 focus:ring-[#0f172a] outline-none transition-all placeholder:text-gray-200 uppercase tracking-widest"
                    />
                 </div>
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={saveAddress}
              className="w-full bg-[#0f172a] text-white py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.4em] hover:bg-black transition shadow-2xl flex items-center justify-center gap-3 mt-4"
            >
              Archive Location <ArrowRight size={14} />
            </motion.button>
          </div>
        </div>
      </div>
      <div className="mt-10" />
    </div>
  );
}