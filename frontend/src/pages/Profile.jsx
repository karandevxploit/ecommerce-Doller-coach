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
} from "lucide-react";
import toast from "react-hot-toast";
import { mapOrder } from "../api/dynamicMapper";
import { useNavigate } from "react-router-dom";

export default function Profile() {
   const navigate = useNavigate();
   const { user, logout, isAuthenticated } = useAuthStore();

   const [activeTab, setActiveTab] = useState("overview");
   const [addresses, setAddresses] = useState([]);
   const [orders, setOrders] = useState([]);
   const [loading, setLoading] = useState(true);

   const [form, setForm] = useState({
      name: "",
      phone: "",
      addressLine1: "",
      city: "",
      state: "",
      pincode: "",
   });

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

            setAddresses(addrRes?.data || addrRes || []);

            const ord = orderRes?.data || orderRes || [];
            setOrders(ord.map(mapOrder));
         } catch {
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

         const res = await api.get(
            ENDPOINTS.AUTH.ADDRESSES
         );
         setAddresses(res?.data || res || []);

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
      <div className="min-h-screen bg-gray-50 py-10 px-4">
         <div className="max-w-6xl mx-auto grid lg:grid-cols-4 gap-8">
            {/* SIDEBAR */}
            <div className="bg-white p-6 rounded-xl border space-y-4">
               <div>
                  <h2 className="font-semibold">
                     {user?.name || "User"}
                  </h2>
                  <p className="text-sm text-gray-500">
                     {user?.email}
                  </p>
               </div>

               <nav className="space-y-2">
                  {[
                     { id: "overview", label: "Profile" },
                     { id: "orders", label: "Orders" },
                     { id: "addresses", label: "Addresses" },
                  ].map((t) => (
                     <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id)}
                        className={`w-full text-left px-3 py-2 rounded ${activeTab === t.id
                              ? "bg-black text-white"
                              : "hover:bg-gray-100"
                           }`}
                     >
                        {t.label}
                     </button>
                  ))}
               </nav>

               <button
                  onClick={logout}
                  className="w-full mt-4 text-red-500 text-sm"
               >
                  Logout
               </button>
            </div>

            {/* CONTENT */}
            <div className="lg:col-span-3 space-y-6">
               {/* OVERVIEW */}
               {activeTab === "overview" && (
                  <div className="bg-white p-6 rounded-xl border">
                     <h2 className="font-semibold mb-4">
                        Profile Details
                     </h2>

                     <div className="space-y-3 text-sm">
                        <p>
                           <strong>Name:</strong> {user?.name}
                        </p>
                        <p>
                           <strong>Email:</strong> {user?.email}
                        </p>
                     </div>
                  </div>
               )}

               {/* ORDERS */}
               {activeTab === "orders" && (
                  <div className="space-y-4">
                     {orders.length === 0 ? (
                        <p className="text-gray-500">
                           No orders yet
                        </p>
                     ) : (
                        orders.map((o) => (
                           <div
                              key={o.id}
                              className="bg-white p-4 rounded-xl border"
                           >
                              <div className="flex justify-between text-sm mb-2">
                                 <span>
                                    Order #{String(o.id).slice(-6)}
                                 </span>
                                 <span>{o.status}</span>
                              </div>

                              <p className="text-sm font-medium">
                                 ₹{o.total}
                              </p>
                           </div>
                        ))
                     )}
                  </div>
               )}

               {/* ADDRESSES */}
               {activeTab === "addresses" && (
                  <div className="space-y-6">
                     {/* LIST */}
                     <div className="grid md:grid-cols-2 gap-4">
                        {addresses.map((a, i) => (
                           <div
                              key={i}
                              className="bg-white p-4 rounded-xl border"
                           >
                              <p className="font-medium">
                                 {a.name}
                              </p>
                              <p className="text-sm text-gray-500">
                                 {a.addressLine1}
                              </p>
                              <p className="text-sm text-gray-500">
                                 {a.city}, {a.state} - {a.pincode}
                              </p>
                           </div>
                        ))}

                        {addresses.length === 0 && (
                           <p className="text-gray-500">
                              No saved addresses
                           </p>
                        )}
                     </div>

                     {/* FORM */}
                     <div className="bg-white p-6 rounded-xl border space-y-4">
                        <h3 className="font-semibold">
                           Add New Address
                        </h3>

                        <input
                           placeholder="Full Name"
                           value={form.name}
                           onChange={(e) =>
                              setForm({
                                 ...form,
                                 name: e.target.value,
                              })
                           }
                           className="w-full border p-3 rounded"
                        />

                        <input
                           placeholder="Phone"
                           value={form.phone}
                           onChange={(e) =>
                              setForm({
                                 ...form,
                                 phone: e.target.value,
                              })
                           }
                           className="w-full border p-3 rounded"
                        />

                        <input
                           placeholder="Address"
                           value={form.addressLine1}
                           onChange={(e) =>
                              setForm({
                                 ...form,
                                 addressLine1: e.target.value,
                              })
                           }
                           className="w-full border p-3 rounded"
                        />

                        <div className="grid grid-cols-2 gap-3">
                           <input
                              placeholder="City"
                              value={form.city}
                              onChange={(e) =>
                                 setForm({
                                    ...form,
                                    city: e.target.value,
                                 })
                              }
                              className="border p-3 rounded"
                           />

                           <input
                              placeholder="State"
                              value={form.state}
                              onChange={(e) =>
                                 setForm({
                                    ...form,
                                    state: e.target.value,
                                 })
                              }
                              className="border p-3 rounded"
                           />
                        </div>

                        <input
                           placeholder="Pincode"
                           value={form.pincode}
                           onChange={(e) =>
                              setForm({
                                 ...form,
                                 pincode: e.target.value,
                              })
                           }
                           className="w-full border p-3 rounded"
                        />

                        <button
                           onClick={saveAddress}
                           className="w-full bg-black text-white py-3 rounded"
                        >
                           Save Address
                        </button>
                     </div>
                  </div>
               )}
            </div>
         </div>
      </div>
   );
}