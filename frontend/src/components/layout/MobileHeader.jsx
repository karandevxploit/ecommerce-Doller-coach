import { Link } from "react-router-dom";
import NotificationsDropdown from "../NotificationsDropdown";
import { useAuthStore } from "../../store";

export default function MobileHeader() {
  const { isAuthenticated } = useAuthStore();

  return (
    <header className="md:hidden sticky top-0 z-50 px-4 pt-4">

      {/* Floating Header */}
      <div className="relative flex items-center justify-between h-14 px-4 rounded-xl bg-white border border-gray-100 shadow-sm">

        {/* Brand */}
        <Link to="/" className="flex items-center gap-2 relative">
          
          <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-[#0f172a] text-white font-black text-sm shadow-sm transition-all duration-300">
            D
          </div>

          <div className="flex flex-col">
            <h1 className="text-xl font-black text-[#1e3a8a] tracking-tight uppercase leading-none">
              DOLLER <span className="text-[#0f172a]">Coach</span>
            </h1>
            <p className="text-[7px] font-black uppercase tracking-widest text-gray-400 mt-1 uppercase">
              (By Gangwani and Company)
            </p>
          </div>
        </Link>

        {/* Right Side */}
        <div className="flex items-center gap-2">
          {isAuthenticated && (
            <div className="scale-90">
              <NotificationsDropdown />
            </div>
          )}
        </div>

      </div>
    </header>
  );
}