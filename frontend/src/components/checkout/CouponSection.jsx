import { useState } from "react";
import { Plus, X, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import CouponCard from "../ui/CouponCard";

export default function CouponSection({ code, setCode, onApply, onRemove, isApplied, isLoading,  availableCoupons = [] }) {
  const [showOffers, setShowOffers] = useState(false);

  const activeCoupons = (availableCoupons || []).filter(c => c.status === "active");
  const upcomingCoupons = (availableCoupons || []).filter(c => c.status === "upcoming");

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4 shadow-sm group hover:border-[#0f172a] transition-all">
      <div className="flex items-center justify-between pl-1">
        <div className="flex items-center gap-2">
          <div className="h-1 w-8 bg-[#0f172a] rounded-full group-hover:w-12 transition-all" />
          <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest leading-none">Promotion Key</span>
        </div>
        
        {!isApplied && (activeCoupons.length > 0 || upcomingCoupons.length > 0) && (
          <button 
            onClick={() => setShowOffers(!showOffers)}
            className="flex items-center gap-1 text-[9px] font-black text-[#1e3a8a] bg-[#1e3a8a]/5 px-2 py-1 rounded-lg uppercase tracking-widest hover:bg-[#1e3a8a] hover:text-white transition-all shadow-sm"
          >
            {showOffers ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            {showOffers ? "Hide Logic" : "View Manifests"}
          </button>
        )}
      </div>

      {!isApplied && showOffers && (
        <div className="space-y-6 py-2 animate-in slide-in-from-top-4 duration-300">
          {/* ACTIVE SECTION */}
          {activeCoupons.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <div className="h-px flex-1 bg-green-100" />
                <span className="text-[8px] font-black text-green-600 uppercase tracking-widest">Live Manifests</span>
                <div className="h-px flex-1 bg-green-100" />
              </div>
              <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-1">
                {activeCoupons.map((coupon) => (
                  <CouponCard 
                    key={coupon.id || coupon._id} 
                    coupon={coupon} 
                    onApply={(c) => {
                      setCode(c);
                      onApply(c);
                      setShowOffers(false);
                    }} 
                  />
                ))}
              </div>
            </div>
          )}

          {/* UPCOMING SECTION */}
          {upcomingCoupons.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <div className="h-px flex-1 bg-amber-100" />
                <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest">Upcoming Sequences</span>
                <div className="h-px flex-1 bg-amber-100" />
              </div>
              <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-1">
                {upcomingCoupons.map((coupon) => (
                  <CouponCard 
                    key={coupon.id || coupon._id} 
                    coupon={coupon} 
                  />
                ))}
              </div>
            </div>
          )}

          {activeCoupons.length === 0 && upcomingCoupons.length === 0 && (
            <div className="py-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
               <p className="text-[10px] font-black uppercase tracking-widest text-gray-300">No offers available right now</p>
            </div>
          )}
        </div>
      )}

      <div className="relative">
        <input
          type="text"
          placeholder="ENTER DISCOUNT CODE"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          disabled={isApplied || isLoading}
          className="w-full h-12 pl-5 pr-28 bg-gray-50 border border-transparent rounded-xl text-xs font-black tracking-widest outline-none focus:bg-white focus:border-[#0f172a] transition-all uppercase placeholder:text-gray-200 disabled:opacity-50"
        />
        {!isApplied ? (
          <button
            onClick={() => onApply(code)}
            disabled={isLoading || !code.trim()}
            className="absolute right-1 top-1 bottom-1 px-5 bg-[#1e3a8a] text-white rounded-lg text-[9px] font-black uppercase tracking-[0.2em] hover:bg-black transition-all disabled:opacity-30 disabled:hover:scale-100 shadow-md flex items-center justify-center"
          >
            {isLoading ? "..." : <><Plus size={14} strokeWidth={4} className="mr-1" /> VALIDATE</>}
          </button>
        ) : (
          <button
            onClick={onRemove}
            className="absolute right-1 top-1 bottom-1 px-5 bg-red-50 text-red-500 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] hover:bg-red-100 transition-all flex items-center justify-center border border-red-100"
          >
            <X size={14} strokeWidth={4} className="mr-1" /> EXTINGUISH
          </button>
        )}
      </div>

      {isApplied && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg border border-green-100">
           <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
           <p className="text-[9px] text-green-600 font-black uppercase tracking-widest">Access granted: Discount successfully injected.</p>
        </div>
      )}
    </div>
  );
}
