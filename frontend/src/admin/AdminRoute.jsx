import { Navigate, useNavigate } from "react-router-dom";
import { ShieldAlert, ArrowLeft, Layout } from "lucide-react";
import { useMemo } from "react";

import { useAuthStore } from "../store";
import GlobalLoader from "../components/ui/GlobalLoader";

export default function AdminRoute({ children }) {
   const { isAuthenticated, isAdminAuthenticated, loading, isFetchingUser } = useAuthStore();
   const navigate = useNavigate();

   // ✅ stable trace ID (no re-render change)
   const traceId = useMemo(
      () => Math.random().toString(36).slice(2, 10).toUpperCase(),
      []
   );

   // ✅ prevent auth flicker / race condition
   if (loading || isFetchingUser) {
      return <GlobalLoader isVisible />;
   }

   // ❌ not logged in → redirect
   if (!isAuthenticated) {
      return <Navigate to="/admin/login" replace />;
   }

   // ❌ logged in but not admin
   if (!isAdminAuthenticated) {
      return (
         <div className="min-h-screen flex items-center justify-center bg-white text-[#0f172a] px-6">
            <div className="max-w-[480px] w-full text-center space-y-12">

               {/* ICON */}
               <div className="flex justify-center">
                  <div className="h-24 w-24 rounded-[2.5rem] bg-[#0f172a] text-red-500 flex items-center justify-center shadow-sm">
                     <ShieldAlert size={48} strokeWidth={2.5} />
                  </div>
               </div>

               {/* TEXT */}
               <div className="space-y-4">
                  <h1 className="text-4xl font-black uppercase tracking-tighter leading-none">
                     Unauthorized Access
                  </h1>
                  <p className="text-[12px] font-black text-gray-400 uppercase tracking-[0.4em] px-8 leading-relaxed">
                     You do not have permission to access this resource.
                  </p>
               </div>

               {/* ACTIONS */}
               <div className="flex flex-col gap-3">

                  {/* 🔥 FIX: SPA navigation (no reload) */}
                  <button
                     onClick={() => navigate("/")}
                     className="w-full h-18 bg-[#0f172a] text-white rounded-full font-black uppercase tracking-widest text-[12px] flex items-center justify-center gap-3 shadow-xl hover:-translate-y-1 transition-all"
                  >
                     <ArrowLeft size={18} strokeWidth={3} />
                     Go to Home
                  </button>

                  <button
                     onClick={() => navigate("/admin/login")}
                     className="w-full h-18 bg-[#f1f5f9] text-gray-400 rounded-full font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 hover:bg-[#0f172a] hover:text-white transition-all"
                  >
                     <Layout size={18} />
                     Login as Admin
                  </button>

               </div>

               {/* FOOTER */}
               <div className="pt-12 flex justify-center gap-5">
                  <div className="flex items-center gap-2 text-[9px] font-black text-gray-300 uppercase tracking-widest">
                     <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                     Access Denied
                  </div>

                  <div className="flex items-center gap-2 text-[9px] font-black text-gray-300 uppercase tracking-widest">
                     <div className="h-1.5 w-1.5 rounded-full bg-[#0f172a]" />
                     Trace ID: {traceId}
                  </div>
               </div>

            </div>
         </div>
      );
   }

   // ✅ allowed
   return children;
}