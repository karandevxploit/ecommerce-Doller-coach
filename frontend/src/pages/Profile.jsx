import { useState, useEffect } from "react";
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
   Search as SearchIcon
} from "lucide-react";
import toast from "react-hot-toast";
import { mapOrder } from "../api/dynamicMapper";
import { useNavigate } from "react-router-dom";
import { 
  GoogleMap, 
  Autocomplete, 
  Marker, 
  useJsApiLoader 
} from "@react-google-maps/api";

const libraries = ["places"];

export default function Profile() {
   const navigate = useNavigate();
   const { user, logout, isAuthenticated } = useAuthStore();

   const [activeTab, setActiveTab] = useState("overview");
   const [addresses, setAddresses] = useState([]);
   const [orders, setOrders] = useState([]);
   const [loading, setLoading] = useState(true);
   const [isDetecting, setIsDetecting] = useState(false);

   const [mapCenter, setMapCenter] = useState({ lat: 28.6139, lng: 77.2090 }); // Delhi default
   const [autocomplete, setAutocomplete] = useState(null);

   const { isLoaded } = useJsApiLoader({
     id: 'google-map-script',
     googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
     libraries
   });

   const [form, setForm] = useState({
      name: "",
      phone: "",
      addressLine1: "",
      city: "",
      state: "",
      pincode: "",
      latitude: null,
      longitude: null,
   });

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

           setForm(prev => ({
             ...prev,
             city: data.city || data.locality || "",
             state: data.principalSubdivision || "",
             pincode: data.postcode || "",
             addressLine1: data.locality || "",
             latitude,
             longitude
           }));

           toast.success("Location detected ✅");
         } catch (err) {
           toast.error("Failed to fetch address details");
         } finally {
           setIsDetecting(false);
         }
       },
       (error) => {
         setIsDetecting(false);
         toast.error("Location permission denied");
       },
       { enableHighAccuracy: true }
     );
   };

   const onPlaceChanged = () => {
     if (autocomplete !== null) {
       const place = autocomplete.getPlace();
       if (!place.geometry) return;

       const lat = place.geometry.location.lat();
       const lng = place.geometry.location.lng();
       setMapCenter({ lat, lng });

       const components = place.address_components;
       const getComp = (type) => components.find(c => c.types.includes(type))?.long_name || "";

       setForm(prev => ({
         ...prev,
         addressLine1: place.formatted_address || "",
         city: getComp("locality") || getComp("administrative_area_level_2"),
         state: getComp("administrative_area_level_1"),
         pincode: getComp("postal_code"),
         latitude: lat,
         longitude: lng
       }));
     }
   };

   /* ---------------- FETCH ---------------- */
   useEffect(() => {
      if (!isAuthenticated) {
         navigate("/login");
         return;
      }

      const load = async () => {
         try {
            const [addrRes, orderRes] = await Promise.all([
               api.get(ENDPOINTS.AUTH.ADDRESSES),
               api.get(ENDPOINTS.ORDERS.MY),
            ]);

            // Correctly extract from { success: true, addresses: [...] }
            const addressData = addrRes?.data?.addresses || addrRes?.addresses || [];
            setAddresses(addressData);

            // Correctly extract from { success: true, orders: [...] }
            const orderData = orderRes?.data?.orders || orderRes?.orders || [];
            setOrders(orderData.map(mapOrder));
         } catch (err) {
            console.error("Profile load error:", err);
            toast.error("Failed to load profile data");
         } finally {
            setLoading(false);
         }
      };

      load();
   }, [isAuthenticated]);

   /* ---------------- ADDRESS SAVE ---------------- */
   const saveAddress = async () => {
      if (
         !form.name ||
         !form.phone ||
         !form.addressLine1 ||
         !form.city ||
         !form.pincode
      ) {
         return toast.error("Please fill all required fields");
      }

      if (form.pincode.length !== 6) {
         return toast.error("Enter valid pincode");
      }

      try {
         await api.post(ENDPOINTS.AUTH.ADDRESSES, form);

         toast.success("Address saved");

         const res = await api.get(ENDPOINTS.AUTH.ADDRESSES);
         setAddresses(res?.data?.addresses || res?.addresses || []);

         setForm({
            name: "",
            phone: "",
            addressLine1: "",
            city: "",
            state: "",
            pincode: "",
         });
      } catch {
         toast.error("Failed to save address");
      }
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
      <div className="min-h-screen bg-slate-50/50 py-12 px-4">
         <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* SIDEBAR */}
            <div className="bg-white shadow-sm rounded-2xl p-6 h-fit sticky top-24 space-y-6 border border-slate-100">
               <div className="space-y-1">
                  <h2 className="text-xl font-bold text-slate-900 truncate" title={user?.name}>
                     {user?.name || "Premium Member"}
                  </h2>
                  <p className="text-sm text-slate-500 truncate" title={user?.email}>
                     {user?.email}
                  </p>
               </div>

               <nav className="flex flex-col gap-1">
                  {[
                     { id: "overview", label: "Profile Details", icon: User },
                     { id: "orders", label: "My Orders", icon: Package },
                     { id: "addresses", label: "Shipping Addresses", icon: MapPin },
                  ].map((t) => (
                     <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${
                           activeTab === t.id
                              ? "bg-slate-900 text-white shadow-lg shadow-slate-200"
                              : "text-slate-600 hover:bg-slate-50"
                        }`}
                     >
                        <t.icon size={18} />
                        {t.label}
                     </button>
                  ))}
               </nav>

               <div className="pt-4 border-t border-slate-100">
                  <button
                     onClick={logout}
                     className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors font-medium text-sm"
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
                  <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
                     <div className="flex items-center gap-4 mb-8">
                        <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-600">
                           <User size={24} />
                        </div>
                        <div>
                           <h1 className="text-2xl font-bold text-slate-900">Profile Details</h1>
                           <p className="text-sm text-slate-500">Manage your account information</p>
                        </div>
                     </div>

                     <div className="grid gap-6">
                        <div className="p-4 rounded-xl bg-slate-50/50 border border-slate-100 group transition-colors hover:border-slate-200">
                           <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Full Name</p>
                           <p className="text-lg font-medium text-slate-900 break-words">{user?.name}</p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-50/50 border border-slate-100 group transition-colors hover:border-slate-200">
                           <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Email Address</p>
                           <p className="text-lg font-medium text-slate-900 break-words">{user?.email}</p>
                        </div>
                     </div>
                  </div>
               )}

               {/* ORDERS */}
               {activeTab === "orders" && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                     <div className="flex items-center justify-between mb-2">
                        <h2 className="text-xl font-bold text-slate-900">Order History</h2>
                        <span className="text-xs font-bold px-3 py-1 bg-slate-100 rounded-full text-slate-600">
                           {orders.length} Orders
                        </span>
                     </div>
                     {orders.length === 0 ? (
                        <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
                           <Package size={40} className="text-slate-200 mb-4" />
                           <p className="text-slate-500 font-medium">No orders placed yet</p>
                        </div>
                     ) : (
                        orders.map((o) => (
                           <div
                              key={o.id}
                              className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:border-slate-300 transition-all group"
                           >
                              <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                                 <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Order Identifier</p>
                                    <span className="font-mono text-sm font-bold text-slate-900">
                                       #{String(o.id).toUpperCase().slice(-8)}
                                    </span>
                                 </div>
                                 <div className="text-right">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Status</p>
                                    <span className={`text-[10px] font-black uppercase tracking-tighter px-3 py-1 rounded-full ${
                                       o.status?.toLowerCase() === 'delivered' 
                                          ? 'bg-green-100 text-green-700' 
                                          : 'bg-blue-100 text-blue-700'
                                    }`}>
                                       {o.status}
                                    </span>
                                 </div>
                              </div>

                              <div className="flex items-end justify-between pt-4 border-t border-slate-50">
                                 <div>
                                    <p className="text-xs text-slate-400 font-medium mb-1">Total Amount</p>
                                    <p className="text-xl font-black text-slate-900 tracking-tight">
                                       ₹{o.total}
                                    </p>
                                 </div>
                                 <button className="text-xs font-bold uppercase tracking-widest text-slate-900 hover:underline">
                                    View Details
                                 </button>
                              </div>
                           </div>
                        ))
                     )}
                  </div>
               )}

               {/* ADDRESSES */}
               {activeTab === "addresses" && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                     <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-slate-900">Saved Addresses</h2>
                        <button 
                           onClick={() => {
                              const el = document.getElementById('new-address-form');
                              el?.scrollIntoView({ behavior: 'smooth' });
                           }}
                           className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg transition-colors"
                        >
                           <Plus size={14} /> Add New
                        </button>
                     </div>
                     {/* LIST */}
                     <div className="grid md:grid-cols-2 gap-4">
                        {addresses.map((a, i) => (
                           <div
                              key={i}
                              className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:border-slate-300 transition-all relative group"
                           >
                              {a.isDefault && (
                                 <span className="absolute top-4 right-4 text-[9px] font-black uppercase tracking-widest bg-slate-900 text-white px-2 py-0.5 rounded">
                                    Default
                                 </span>
                              )}
                              <p className="font-bold text-slate-900 mb-2 truncate pr-16">
                                 {a.name}
                              </p>
                              <div className="space-y-1">
                                 <p className="text-sm text-slate-500 break-words line-clamp-2">
                                    {a.addressLine1}
                                 </p>
                                 <p className="text-sm text-slate-600 font-medium">
                                    {a.city}, {a.state} - {a.pincode}
                                 </p>
                              </div>
                           </div>
                        ))}

                        {addresses.length === 0 && (
                           <div className="md:col-span-2 bg-white p-12 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
                              <MapPin size={40} className="text-slate-200 mb-4" />
                              <p className="text-slate-500 font-medium">No saved addresses</p>
                           </div>
                        )}
                     </div>

                     {/* FORM */}
                     <div id="new-address-form" className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-6">
                        <div className="flex items-center justify-between gap-4">
                           <h3 className="font-semibold text-lg text-slate-900">
                              Add New Address
                           </h3>
                           <button
                              onClick={detectLocation}
                              disabled={isDetecting}
                              className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-lg transition-all ${
                                 isDetecting 
                                 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                                 : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                              }`}
                           >
                              <Navigation size={12} className={isDetecting ? "animate-pulse" : ""} />
                              {isDetecting ? "Detecting..." : "Use Current Location"}
                           </button>
                        </div>

                        {form.latitude && !isDetecting && (
                          <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-600 rounded-full w-fit animate-in fade-in zoom-in duration-300">
                             <span className="text-[10px] font-bold uppercase tracking-wider">Location Synced ✅</span>
                          </div>
                        )}

                        {/* SMART SEARCH */}
                        {isLoaded && (
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
                                  className="w-full bg-slate-900 text-white placeholder:text-slate-500 border-none p-4 rounded-xl focus:ring-4 focus:ring-slate-900/10 transition-all text-sm pl-12"
                                />
                              </Autocomplete>
                              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            </div>
                            <p className="text-[9px] text-slate-400 mt-1 ml-1">Powered by Google Maps</p>
                          </div>
                        )}

                        {/* MAP PREVIEW */}
                        {isLoaded && (
                          <div className="h-48 rounded-2xl overflow-hidden border border-slate-100 shadow-inner bg-slate-50 relative">
                             <GoogleMap
                               mapContainerStyle={{ width: '100%', height: '100%' }}
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
                                 className="w-full bg-slate-50 border border-slate-100 p-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:bg-white transition-all text-sm"
                              />
                           </div>

                           <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Contact Number</label>
                              <input
                                 placeholder="Phone Number"
                                 value={form.phone}
                                 onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                 className="w-full bg-slate-50 border border-slate-100 p-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:bg-white transition-all text-sm"
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
                              className="w-full bg-slate-50 border border-slate-100 p-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:bg-white transition-all text-sm resize-none"
                           />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">City</label>
                              <input
                                 placeholder="City"
                                 value={form.city}
                                 onChange={(e) => setForm({ ...form, city: e.target.value })}
                                 className="w-full bg-slate-50 border border-slate-100 p-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:bg-white transition-all text-sm"
                              />
                           </div>

                           <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">State / Province</label>
                              <input
                                 placeholder="State"
                                 value={form.state}
                                 onChange={(e) => setForm({ ...form, state: e.target.value })}
                                 className="w-full bg-slate-50 border border-slate-100 p-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:bg-white transition-all text-sm"
                              />
                           </div>
                        </div>

                        <div className="space-y-1">
                           <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Zip / Postal Code</label>
                           <input
                              placeholder="6-digit Pincode"
                              value={form.pincode}
                              onChange={(e) => setForm({ ...form, pincode: e.target.value })}
                              className="w-full bg-slate-50 border border-slate-100 p-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:bg-white transition-all text-sm"
                           />
                        </div>

                        <button
                           onClick={saveAddress}
                           disabled={isDetecting}
                           className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold uppercase tracking-[0.2em] text-[10px] transition-all hover:bg-black hover:shadow-xl hover:shadow-slate-200 active:scale-[0.98] disabled:opacity-50"
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