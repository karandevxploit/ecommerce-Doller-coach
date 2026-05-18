import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Layout,
  Layers,
  Tag,
  MessageSquare,
  Settings,
  Truck,
} from "lucide-react";
import { useConfigStore } from "../../store/configStore";
import logo from "@/assets/logo.png";

const navItems = [
  { name: "Overview", path: "/admin/dashboard", icon: LayoutDashboard },
  { name: "Items", path: "/admin/products", icon: Package },
  { name: "Categories", path: "/admin/categories", icon: Layers },
  { name: "Purchases", path: "/admin/orders", icon: ShoppingCart },
  { name: "Customers", path: "/admin/users", icon: Users },
  { name: "Site Layout", path: "/admin/site-content", icon: Layout },
  { name: "Offers", path: "/admin/offers", icon: Tag },
  { name: "Reviews", path: "/admin/reviews", icon: MessageSquare },
  { name: "Shipments", path: "/admin/shipments", icon: Truck },
];

const isRouteActive = (pathname, itemPath) => {
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
};

export default function Sidebar({ onNavigate }) {
  const location = useLocation();
  const { config } = useConfigStore();

  const companyName = config?.company_name || "Doller Coach";
  const isSettingsActive = isRouteActive(location.pathname, "/admin/settings");

  return (
    <aside className="w-full h-full bg-white flex flex-col pt-4">
      {/* Brand Header */}
      <div className="h-14 flex items-center px-5 mb-5">
        <Link
          to="/"
          className="flex items-center gap-3 transition-opacity hover:opacity-80 min-w-0"
          onClick={onNavigate}
          aria-label={companyName}
        >
          <img src={logo} alt={companyName} className="h-8 w-auto object-contain shrink-0" />
          <span className="text-base font-black text-slate-950 tracking-tight uppercase truncate">
            {companyName}
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1" aria-label="Admin navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = isRouteActive(location.pathname, item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-xs font-black uppercase tracking-wide ${isActive
                  ? "bg-slate-950 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-950 hover:bg-slate-100"
                }`}
            >
              <Icon
                size={18}
                className={isActive ? "text-white" : "text-slate-400"}
                strokeWidth={isActive ? 2.5 : 2}
              />
              {item.name}
            </Link>
          );
        })}

        <Link
          to="/admin/settings"
          onClick={onNavigate}
          aria-current={isSettingsActive ? "page" : undefined}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-xs font-black uppercase tracking-wide ${isSettingsActive
              ? "bg-slate-950 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-950 hover:bg-slate-100"
            }`}
        >
          <Settings
            size={18}
            className={isSettingsActive ? "text-white" : "text-slate-400"}
            strokeWidth={isSettingsActive ? 2.5 : 2}
          />
          Settings
        </Link>
      </nav>

      {/* Footer Info */}
      <div className="p-4 mx-3 mb-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
        <span className="text-xs font-bold text-slate-600">
          All systems operational
        </span>
      </div>
    </aside>
  );
}
