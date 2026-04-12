import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Tag,
  MessageSquare,
  Zap,
  Box,
  Settings
} from "lucide-react";
import { useConfigStore } from "../../store/configStore";

export default function Sidebar({ onNavigate }) {
  const location = useLocation();
  const { config } = useConfigStore();

  const navItems = [
    { name: "Overview", path: "/admin/dashboard", icon: LayoutDashboard },
    { name: "Items", path: "/admin/products", icon: Package },
    { name: "Purchases", path: "/admin/orders", icon: ShoppingCart },
    { name: "Customers", path: "/admin/users", icon: Users },
    { name: "Offers", path: "/admin/offers", icon: Tag },
    { name: "Reviews", path: "/admin/reviews", icon: MessageSquare },
    { name: "System Health", path: "/admin/performance", icon: Zap },
  ];

  return (
    <aside className="w-full h-full bg-white flex flex-col pt-4">
      
      {/* Brand Header */}
      <div className="h-14 flex items-center px-6 mb-6">
        <Link
          to="/"
          className="flex items-center gap-3 transition-opacity hover:opacity-80"
          onClick={onNavigate}
        >
          {config?.logo ? (
            <img src={config.logo} alt="brand" className="h-8 w-auto object-contain" />
          ) : (
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm font-black italic">
               D
            </div>
          )}
          <span className="text-base font-bold text-gray-900 tracking-tight uppercase">
             {config?.company_name || "Doller Coach"}
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            location.pathname === item.path ||
            location.pathname.startsWith(item.path);

          return (
            <Link
              key={item.name}
              to={item.path}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium ${
                isActive
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <Icon 
                size={18} 
                className={isActive ? "text-gray-900" : "text-gray-400"} 
                strokeWidth={isActive ? 2.5 : 2} 
              />
              {item.name}
            </Link>
          );
        })}
        <Link
          to="/admin/settings"
          onClick={onNavigate}
          className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium ${
            location.pathname === "/admin/settings"
              ? "bg-gray-100 text-gray-900"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          }`}
        >
          <Settings 
            size={18} 
            className={location.pathname === "/admin/settings" ? "text-gray-900" : "text-gray-400"} 
            strokeWidth={location.pathname === "/admin/settings" ? 2.5 : 2} 
          />
          Settings 
        </Link>
      </nav>

      {/* Footer Info */}
      <div className="p-4 mx-3 mb-4 rounded-lg bg-gray-50 border border-gray-100 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
        <span className="text-xs font-medium text-gray-600">All systems operational</span>
      </div>
    </aside>
  );
}