import { useEffect, useState, useMemo } from "react";
import { useAuthStore } from "../store";
import { api } from "../api/client";
import { ENDPOINTS } from "../api/endpoints";
import {
   LogOut,
   MapPin,
   Package,
   User,
   Plus,
   Navigation,
   Map as MapIcon,
   Search as SearchIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { mapOrder } from "../api/dynamicMapper";
import { useNavigate } from "react-router-dom";
import {
   GoogleMap,
   Autocomplete,
   Marker,
   useJsApiLoader,
} from "@react-google-maps/api";
import { formatPrice } from "../utils/format";

const libraries = ["places"];

const EMPTY_ADDRESS = {
   name: "",
   phone: "",
   addressLine1: "",
   city: "",
   state: "",
   pincode: "",
   latitude: null,
   longitude: null,
};

const getList = (response, key) => {
   const data = response?.data ?? response;
   const payload = data?.data ?? data;

   if (Array.isArray(payload)) return payload;
   if (Array.isArray(payload?.[key])) return payload[key];
   if (Array.isArray(payload?.items)) return payload.items;
   if (Array.isArray(payload?.data)) return payload.data;

   return [];
};

const safeNumber = (value, fallback = 0) => {
   const parsed = Number(value);
   return Number.isFinite(parsed) ? parsed : fallback;
};

const getOrderDisplayId = (order = {}) => {
   const invoice = String(order?.invoiceNumber || "").trim();
   if (invoice && invoice.toUpperCase() !== "N/A") return invoice;

   const raw = String(order?.orderNumber || order?.id || order?._id || "").trim();
   return raw ? `ORD-${raw.slice(-8).toUpperCase()}` : "";
};
const DELIVERY_FEE = 40;
const COD_FEE = 50;

export default function Profile() {
   const navigate = useNavigate();
   const { user, logout, isAuthenticated } = useAuthStore();

   const [activeTab, setActiveTab] = useState("overview");
   const [addresses, setAddresses] = useState([]);
   const [orders, setOrders] = useState([]);
   const [loading, setLoading] = useState(true);
   const [isDetecting, setIsDetecting] = useState(false);

   const [mapCenter, setMapCenter] = useState({
      lat: 28.6139,
      lng: 77.2090,
   });
   const [autocomplete, setAutocomplete] = useState(null);
   const [form, setForm] = useState(EMPTY_ADDRESS);

   const googleMapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

   const { isLoaded } = useJsApiLoader({
      id: "google-map-script",
      googleMapsApiKey: googleMapsKey,
      libraries,
   });

   const canUseGoogleMaps = Boolean(googleMapsKey && isLoaded);

   const mappedOrders = useMemo(() => {
      return Array.isArray(orders) ? orders : [];
   }, [orders]);

   /* ---------------- SMART LOCATION ---------------- */
   const detectLocation = () => {
      if (!navigator.geolocation) {
         return toast.error("Geolocation is not supported by your browser");
      }

      setIsDetecting(true);

      navigator.geolocation.getCurrentPosition(
         async (position) => {
            const { latitude, longitude } = position.coords;
            setMapCenter({ lat: latitude, lng: longitude });

            try {
               const res = await fetch(
                  `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
               );
               const data = await res.json();

               setForm((prev) => ({
                  ...prev,
                  city: data.city || data.locality || "",
                  state: data.principalSubdivision || "",
                  pincode: String(data.postcode || "").replace(/\D/g, "").slice(0, 6),
                  addressLine1: data.locality || data.localityInfo?.administrative?.[0]?.name || "",
                  latitude,
                  longitude,
               }));

               toast.success("Location detected");
            } catch {
               toast.error("Failed to fetch address details");
            } finally {
               setIsDetecting(false);
            }
         },
         () => {
            setIsDetecting(false);
            toast.error("Location permission denied");
         },
         { enableHighAccuracy: true, timeout: 10000 }
      );
   };

   const onPlaceChanged = () => {
      if (!autocomplete) return;

      const place = autocomplete.getPlace();
      if (!place?.geometry?.location) return;

      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();

      setMapCenter({ lat, lng });

      const components = place.address_components || [];
      const getComp = (type) =>
         components.find((component) => component.types.includes(type))
            ?.long_name || "";

      setForm((prev) => ({
         ...prev,
         addressLine1: place.formatted_address || prev.addressLine1,
         city: getComp("locality") || getComp("administrative_area_level_2"),
         state: getComp("administrative_area_level_1"),
         pincode: getComp("postal_code").replace(/\D/g, "").slice(0, 6),
         latitude: lat,
         longitude: lng,
      }));
   };

   /* ---------------- FETCH ---------------- */
   useEffect(() => {
      let mounted = true;

      if (!isAuthenticated) {
         navigate("/login", { replace: true });
         return undefined;
      }

      const load = async () => {
         try {
            setLoading(true);

            const [addrRes, orderRes] = await Promise.all([
               api.get(ENDPOINTS.AUTH.ADDRESSES),
               api.get(ENDPOINTS.ORDERS.MY),
            ]);

            if (!mounted) return;

            setAddresses(getList(addrRes, "addresses"));
            setOrders(getList(orderRes, "orders").map(mapOrder).filter(Boolean));
         } catch (err) {
            if (mounted) {
               toast.error(err?.response?.data?.message || "Failed to load profile data");
            }
         } finally {
            if (mounted) setLoading(false);
         }
      };

      load();

      return () => {
         mounted = false;
      };
   }, [isAuthenticated, navigate]);

   /* ---------------- ADDRESS SAVE ---------------- */
   const saveAddress = async () => {
      const payload = {
         ...form,
         name: form.name.trim(),
         phone: form.phone.replace(/\D/g, "").slice(0, 10),
         addressLine1: form.addressLine1.trim(),
         city: form.city.trim(),
         state: form.state.trim(),
         pincode: form.pincode.replace(/\D/g, "").slice(0, 6),
      };

      if (
         !payload.name ||
         !payload.phone ||
         !payload.addressLine1 ||
         !payload.city ||
         !payload.state ||
         !payload.pincode
      ) {
         return toast.error("Please fill all required fields");
      }

      if (payload.phone.length !== 10) {
         return toast.error("Enter valid phone number");
      }

      if (payload.pincode.length !== 6) {
         return toast.error("Enter valid pincode");
      }

      try {
         await api.post(ENDPOINTS.AUTH.ADDRESSES, payload);

         toast.success("Address saved");

         const res = await api.get(ENDPOINTS.AUTH.ADDRESSES);
         setAddresses(getList(res, "addresses"));
         setForm(EMPTY_ADDRESS);
      } catch (err) {
         toast.error(err?.response?.data?.message || "Failed to save address");
      }
   };

   const handleLogout = () => {
      logout?.();
      navigate("/", { replace: true });
   };

   /* ---------------- LOADING ---------------- */
   if (loading) {
      return (
         <div className="min-h-screen flex items-center justify-center">
            <div className="h-10 w-10 border-2 border-black border-t-transparent animate-spin rounded-full" />
         </div>
      );
   }

   /* ---------------- UI ---------------- */
   return (
      <div className="min-h-screen bg-slate-50">
         <div className="page-shell grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* SIDEBAR */}
            <div className="surface p-5 h-fit sticky top-24 space-y-5">
               <div className="space-y-1">
                  <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 truncate" title={user?.name}>
                     {user?.name || "Premium Member"}
                  </h2>
                  <p className="text-sm text-slate-500 truncate" title={user?.email}>
                     {user?.email || ""}
                  </p>
               </div>

               <nav className="flex flex-col gap-1">
                  {[
                     { id: "overview", label: "Profile Details", icon: User },
                     { id: "orders", label: "My Orders", icon: Package },
                     { id: "addresses", label: "Shipping Addresses", icon: MapPin },
                  ].map((tab) => (
                     <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                     className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all font-black text-xs uppercase tracking-wide ${activeTab === tab.id
                              ? "bg-slate-900 text-white shadow-lg shadow-slate-200"
                              : "text-slate-600 hover:bg-slate-50"
                           }`}
                     >
                        <tab.icon size={18} />
                        {tab.label}
                     </button>
                  ))}
               </nav>

               <div className="pt-4 border-t border-slate-100">
                  <button
                     type="button"
                     onClick={handleLogout}
                     className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-lg transition-colors font-black text-xs uppercase tracking-wide"
                  >
                     <LogOut size={18} />
                     Logout Account
                  </button>
               </div>
            </div>

            {/* CONTENT */}
            <div className="md:col-span-2 space-y-6">
               {/* OVERVIEW */}
               {activeTab === "overview" && (
                  <div className="surface p-5 md:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                     <div className="flex items-center gap-4 mb-8">
                        <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-600">
                           <User size={24} />
                        </div>
                        <div>
                           <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">Profile Details</h1>
                           <p className="text-sm text-slate-500">Manage your account information</p>
                        </div>
                     </div>

                     <div className="grid gap-6">
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 group transition-colors hover:border-slate-300">
                           <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Full Name</p>
                           <p className="text-lg font-medium text-slate-900 break-words">{user?.name || "-"}</p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 group transition-colors hover:border-slate-300">
                           <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Email Address</p>
                           <p className="text-lg font-medium text-slate-900 break-words">{user?.email || "-"}</p>
                        </div>
                     </div>
                  </div>
               )}

               {/* ORDERS */}
               {activeTab === "orders" && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                     <div className="flex items-center justify-between mb-2">
                        <h2 className="text-xl font-black uppercase tracking-tight text-slate-900">Order History</h2>
                        <span className="text-xs font-bold px-3 py-1 bg-slate-100 rounded-full text-slate-600">
                           {mappedOrders.length} Orders
                        </span>
                     </div>

                     {mappedOrders.length === 0 ? (
                        <div className="empty-state">
                           <Package size={40} className="text-slate-200 mb-4" />
                           <p className="text-slate-500 font-medium">No orders placed yet</p>
                        </div>
                     ) : (
                        mappedOrders.map((order, index) => {
                           const orderId = order.id || order._id || `order-${index}`;
                           const subtotal = safeNumber(order.subtotal);
                           const discount = safeNumber(order.discount);
                           const gst = safeNumber(order.gst ?? order.gstAmount);
                           const gstPercent = safeNumber(order.gstPercent, 18);
                           const delivery = safeNumber(order.delivery ?? order.deliveryFee, DELIVERY_FEE) || DELIVERY_FEE;
                           const isCod = String(order.paymentMethod || "COD").toUpperCase() === "COD";
                           const codFee = isCod ? Math.max(safeNumber(order.codFee), COD_FEE) : 0;
                           const total = subtotal - discount + gst + delivery + codFee;

                           return (
                              <div
                                 key={orderId}
                                 className="surface p-4 md:p-5 hover:border-slate-300 transition-all group"
                              >
                                 <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                                    <div>
                                       <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Order Identifier</p>
                                       <span className="font-mono text-sm font-bold text-slate-900">
                                          {getOrderDisplayId(order)}
                                       </span>
                                    </div>
                                    <div className="text-right">
                                       <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Status</p>
                                       <span
                                          className={`text-[10px] font-black uppercase tracking-tighter px-3 py-1 rounded-full ${order.status?.toLowerCase() === "delivered"
                                                ? "bg-green-100 text-green-700"
                                                : order.status?.toLowerCase() === "cancelled"
                                                   ? "bg-red-100 text-red-700"
                                                   : "bg-blue-100 text-blue-700"
                                             }`}
                                       >
                                          {order.status || "placed"}
                                       </span>
                                    </div>
                                 </div>

                                 <div className="pt-4 border-t border-slate-50 space-y-3">
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                                       <div className="flex justify-between gap-3">
                                          <span className="text-slate-500">Subtotal</span>
                                          <span className="font-semibold text-slate-900">{formatPrice(subtotal)}</span>
                                       </div>
                                       <div className="flex justify-between gap-3">
                                          <span className="text-slate-500">GST ({gstPercent}%)</span>
                                          <span className="font-semibold text-slate-900">{formatPrice(gst)}</span>
                                       </div>
                                       {discount > 0 && (
                                          <div className="flex justify-between gap-3 text-green-600">
                                             <span>Discount</span>
                                             <span className="font-semibold">-{formatPrice(discount)}</span>
                                          </div>
                                       )}
                                       <div className="flex justify-between gap-3">
                                          <span className="text-slate-500">Delivery</span>
                                          <span className="font-semibold text-slate-900">
                                             {formatPrice(delivery)}
                                          </span>
                                       </div>
                                       {codFee > 0 && (
                                          <div className="flex justify-between gap-3">
                                             <span className="text-slate-500">COD Fee</span>
                                             <span className="font-semibold text-slate-900">{formatPrice(codFee)}</span>
                                          </div>
                                       )}
                                    </div>

                                    <div className="flex items-end justify-between">
                                       <div>
                                          <p className="text-xs text-slate-400 font-medium mb-1">Total Amount</p>
                                          <p className="text-xl font-black text-slate-900 tracking-tight">
                                             {formatPrice(total)}
                                          </p>
                                       </div>
                                       <button
                                          type="button"
                                          onClick={() => navigate(`/order/${orderId}`)}
                                          className="text-xs font-bold uppercase tracking-widest text-slate-900 hover:underline"
                                       >
                                          View Details
                                       </button>
                                    </div>
                                 </div>
                              </div>
                           );
                        })
                     )}
                  </div>
               )}

               {/* ADDRESSES */}
               {activeTab === "addresses" && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                     <div className="flex items-center justify-between">
                        <h2 className="text-xl font-black uppercase tracking-tight text-slate-900">Saved Addresses</h2>
                        <button
                           type="button"
                           onClick={() => {
                              document.getElementById("new-address-form")?.scrollIntoView({ behavior: "smooth" });
                           }}
                           className="btn-luxury-outline h-10 px-4"
                        >
                           <Plus size={14} /> Add New
                        </button>
                     </div>

                     <div className="grid md:grid-cols-2 gap-4">
                        {addresses.map((address, index) => (
                           <div
                              key={address._id || address.id || `address-${index}`}
                              className="surface p-4 md:p-5 hover:border-slate-300 transition-all relative group"
                           >
                              {address.isDefault && (
                                 <span className="absolute top-4 right-4 text-[9px] font-black uppercase tracking-widest bg-slate-900 text-white px-2 py-0.5 rounded">
                                    Default
                                 </span>
                              )}
                              <p className="font-bold text-slate-900 mb-2 truncate pr-16">
                                 {address.name || address.fullName || "Address"}
                              </p>
                              <div className="space-y-1">
                                 <p className="text-sm text-slate-500 break-words line-clamp-2">
                                    {address.addressLine1 || address.address || "-"}
                                 </p>
                                 <p className="text-sm text-slate-600 font-medium">
                                    {address.city}, {address.state} - {address.pincode}
                                 </p>
                              </div>
                           </div>
                        ))}

                        {addresses.length === 0 && (
                           <div className="md:col-span-2 empty-state">
                              <MapPin size={40} className="text-slate-200 mb-4" />
                              <p className="text-slate-500 font-medium">No saved addresses</p>
                           </div>
                        )}
                     </div>

                     {/* FORM */}
                     <div id="new-address-form" className="surface p-5 md:p-6 space-y-5">
                        <div className="flex items-center justify-between gap-4">
                           <h3 className="font-black text-lg uppercase tracking-tight text-slate-900">Add New Address</h3>
                           <button
                              type="button"
                              onClick={detectLocation}
                              disabled={isDetecting}
                              className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-lg transition-all ${isDetecting
                                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                    : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                                 }`}
                           >
                              <Navigation size={12} className={isDetecting ? "animate-pulse" : ""} />
                              {isDetecting ? "Detecting..." : "Use Current Location"}
                           </button>
                        </div>

                        {form.latitude && !isDetecting && (
                           <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-600 rounded-full w-fit animate-in fade-in zoom-in duration-300">
                              <span className="text-[10px] font-bold uppercase tracking-wider">Location Synced</span>
                           </div>
                        )}

                        {canUseGoogleMaps && (
                           <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Search Your Location</label>
                              <div className="relative">
                                 <Autocomplete
                                    onLoad={(auto) => setAutocomplete(auto)}
                                    onPlaceChanged={onPlaceChanged}
                                 >
                                    <input
                                       type="text"
                                       placeholder="Search building, street, or area..."
                                       className="w-full bg-slate-900 text-white placeholder:text-slate-500 border-none p-3.5 rounded-lg focus:ring-4 focus:ring-slate-900/10 transition-all text-sm pl-12"
                                    />
                                 </Autocomplete>
                                 <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                              </div>
                              <p className="text-[9px] text-slate-400 mt-1 ml-1">Powered by Google Maps</p>
                           </div>
                        )}

                        {canUseGoogleMaps && (
                           <div className="h-48 rounded-2xl overflow-hidden border border-slate-100 shadow-inner bg-slate-50 relative">
                              <GoogleMap
                                 mapContainerStyle={{ width: "100%", height: "100%" }}
                                 center={mapCenter}
                                 zoom={15}
                                 options={{
                                    disableDefaultUI: true,
                                    zoomControl: true,
                                 }}
                              >
                                 <Marker position={mapCenter} />
                              </GoogleMap>
                              <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-100 flex items-center gap-2 shadow-sm pointer-events-none">
                                 <MapIcon size={12} className="text-slate-500" />
                                 <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">Live Preview</span>
                              </div>
                           </div>
                        )}

                        <div className="grid md:grid-cols-2 gap-4">
                           <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Recipient Name</label>
                              <input
                                 placeholder="Full Name"
                                 value={form.name}
                                 onChange={(e) => setForm({ ...form, name: e.target.value })}
                                 className="control-input w-full"
                              />
                           </div>

                           <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Contact Number</label>
                              <input
                                 placeholder="Phone Number"
                                 value={form.phone}
                                 onChange={(e) =>
                                    setForm({
                                       ...form,
                                       phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                                    })
                                 }
                                 className="control-input w-full"
                              />
                           </div>
                        </div>

                        <div className="space-y-1">
                           <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Confirmed Address</label>
                           <textarea
                              placeholder="Street, House No, Area"
                              rows={2}
                              value={form.addressLine1}
                              onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
                              className="w-full min-h-24 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 resize-none"
                           />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">City</label>
                              <input
                                 placeholder="City"
                                 value={form.city}
                                 onChange={(e) => setForm({ ...form, city: e.target.value })}
                                 className="control-input w-full"
                              />
                           </div>

                           <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">State / Province</label>
                              <input
                                 placeholder="State"
                                 value={form.state}
                                 onChange={(e) => setForm({ ...form, state: e.target.value })}
                                 className="control-input w-full"
                              />
                           </div>
                        </div>

                        <div className="space-y-1">
                           <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Zip / Postal Code</label>
                           <input
                              placeholder="6-digit Pincode"
                              value={form.pincode}
                              onChange={(e) =>
                                 setForm({
                                    ...form,
                                    pincode: e.target.value.replace(/\D/g, "").slice(0, 6),
                                 })
                              }
                              className="control-input w-full"
                           />
                        </div>

                        <button
                           type="button"
                           onClick={saveAddress}
                           disabled={isDetecting}
                           className="w-full btn-luxury disabled:opacity-50"
                        >
                           {isDetecting ? "Processing Location..." : "Confirm & Save Address"}
                        </button>
                     </div>
                  </div>
               )}
            </div>
         </div>
      </div>
   );
}
