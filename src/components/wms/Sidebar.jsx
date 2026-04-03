import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Package, ClipboardList, PackageCheck, Truck,
  Warehouse, Users, Settings, History, BarChart3, X, LogOut
} from "lucide-react";

const NAV_ITEMS = {
  client: [
    { label: "Дашборд", icon: LayoutDashboard, path: "/" },
    { label: "Заявки на приёмку", icon: ClipboardList, path: "/reception" },
    { label: "Заказы на сборку", icon: PackageCheck, path: "/assembly" },
    { label: "Остатки на складе", icon: Warehouse, path: "/inventory" },
    { label: "История", icon: History, path: "/history" },
  ],
  operator: [
    { label: "Дашборд", icon: LayoutDashboard, path: "/" },
    { label: "Приёмка товара", icon: ClipboardList, path: "/reception" },
    { label: "Сборка заказов", icon: PackageCheck, path: "/assembly" },
    { label: "Отгрузка", icon: Truck, path: "/shipments" },
    { label: "Остатки", icon: Warehouse, path: "/inventory" },
  ],
  admin: [
    { label: "Дашборд", icon: LayoutDashboard, path: "/" },
    { label: "Приёмка", icon: ClipboardList, path: "/reception" },
    { label: "Сборка", icon: PackageCheck, path: "/assembly" },
    { label: "Отгрузка", icon: Truck, path: "/shipments" },
    { label: "Остатки", icon: Warehouse, path: "/inventory" },
    { label: "Товары", icon: Package, path: "/products" },
    { label: "Пользователи", icon: Users, path: "/users" },
    { label: "Статистика", icon: BarChart3, path: "/stats" },
    { label: "Журнал действий", icon: History, path: "/logs" },
  ],
};

export default function Sidebar({ role, isOpen, onClose, user }) {
  const location = useLocation();
  const items = NAV_ITEMS[role] || NAV_ITEMS.client;

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
      )}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-full w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-300 lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <Warehouse className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-white">WMS</span>
              <span className="text-xs text-sidebar-foreground/60 block leading-none">Fulfillment</span>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden p-1 rounded hover:bg-sidebar-accent">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {items.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  isActive
                    ? "bg-sidebar-primary text-white shadow-lg shadow-sidebar-primary/25"
                    : "text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent"
                )}
              >
                <item.icon className="h-4.5 w-4.5 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-bold text-white">
              {user?.full_name?.[0] || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.full_name || "Пользователь"}</p>
              <p className="text-xs text-sidebar-foreground/50 truncate">
                {role === "admin" ? "Администратор" : role === "operator" ? "Оператор" : "Клиент"}
              </p>
            </div>
            <button
              onClick={onLogout}
              className="p-1.5 rounded hover:bg-sidebar-accent text-sidebar-foreground/50 hover:text-white transition-colors"
              title="Выйти"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}