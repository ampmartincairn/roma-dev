import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  LayoutDashboard, Package, ClipboardList, PackageCheck, Truck,
  Warehouse, Users, Settings, History, BarChart3, X, LogOut,
  ChevronDown, ArrowDown, ArrowUp, Shield, FileText, Gavel, UserCheck
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const NAV_ITEMS = [
  {
    label: "Управление складом",
    icon: Warehouse,
    roles: ["admin", "operator", "client"],
    subItems: [
      {
        label: "Входящий поток",
        icon: ArrowDown,
        path: "/incoming-flow",
        roles: ["admin", "operator", "client"]
      },
      {
        label: "Исходящий поток",
        icon: ArrowUp,
        path: "/outgoing-flow",
        roles: ["admin", "operator", "client"],
        subItems: [
          { label: "Заявки на отгрузку", path: "/shipments", roles: ["admin", "operator", "client"] }
        ]
      }
    ]
  },
  { label: "Справочник товаров", icon: FileText, path: "/products", roles: ["admin", "operator", "client"] },
  { label: "Все заказы", icon: Package, path: "/assembly", roles: ["admin", "operator"] },
  { label: "Складские остатки", icon: ClipboardList, path: "/inventory", roles: ["admin", "operator", "client"] },
  { label: "Отчеты", icon: BarChart3, path: "/stats", roles: ["admin", "operator", "client"] },
  { label: "Клиенты", icon: Users, path: "/users", roles: ["admin"] },
  { label: "Безопасность", icon: Shield, path: "/security", roles: ["admin"] }
];

const CLIENT_NAV_ITEMS = [
  { label: "Главная", icon: LayoutDashboard, path: "/", roles: ["client"] },
  {
    label: "Входящий поток",
    icon: ArrowDown,
    path: "/incoming-flow",
    roles: ["client"]
  },
  {
    label: "Исходящий поток",
    icon: ArrowUp,
    path: "/outgoing-flow",
    roles: ["client"],
    subItems: [
      { label: "Заявки на отгрузку", path: "/shipments", roles: ["client"] }
    ]
  },
  { label: "Справочник товаров", icon: FileText, path: "/products", roles: ["client"] },
  { label: "Остатки товара", icon: Warehouse, path: "/inventory", roles: ["client"] }
];

export default function Sidebar({ isOpen, onClose, user, onLogout }) {
  const location = useLocation();
  const [openSections, setOpenSections] = useState({});
  const normalizeRole = (role) => {
    if (role === "user") return "client";
    if (role === "manager") return "operator";
    return role;
  };
  const userRole = normalizeRole(user?.role) || "client";
  const navItems = userRole === "client" ? CLIENT_NAV_ITEMS : NAV_ITEMS;

  const hasAccess = (item) => {
    return !item.roles || item.roles.includes(userRole);
  };

  const toggleSection = (index) => {
    setOpenSections(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const renderNavItem = (item, index, level = 0) => {
    if (!hasAccess(item)) return null;

    const isActive = item.path && location.pathname === item.path;
    const hasSubItems = item.subItems && item.subItems.length > 0;
    const isOpen = openSections[index];

    if (item.action === "logout") {
      return (
        <button
          key={index}
          onClick={onLogout}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all w-full text-left",
            "text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent"
          )}
        >
          <item.icon className="h-4.5 w-4.5 flex-shrink-0" />
          {item.label}
        </button>
      );
    }

    if (hasSubItems) {
      return (
        <Collapsible key={index} open={isOpen} onOpenChange={() => toggleSection(index)}>
          <CollapsibleTrigger asChild>
            {item.path ? (
              <Link
                to={item.path}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all w-full",
                  isActive
                    ? "bg-sidebar-primary text-white shadow-lg shadow-sidebar-primary/25"
                    : "text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent"
                )}
              >
                <item.icon className="h-4.5 w-4.5 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen ? "rotate-180" : "")} />
              </Link>
            ) : (
              <button
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all w-full text-left",
                  "text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent"
                )}
              >
                <item.icon className="h-4.5 w-4.5 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen ? "rotate-180" : "")} />
              </button>
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 ml-6">
            {item.subItems.map((subItem, subIndex) => renderNavItem(subItem, `${index}-${subIndex}`, level + 1))}
          </CollapsibleContent>
        </Collapsible>
      );
    }

    return (
      <Link
        key={index}
        to={item.path}
        onClick={onClose}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
          isActive
            ? "bg-sidebar-primary text-white shadow-lg shadow-sidebar-primary/25"
            : "text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent",
          level > 0 && "ml-6"
        )}
      >
        {item.icon && <item.icon className="h-4.5 w-4.5 flex-shrink-0" />}
        {item.label}
      </Link>
    );
  };

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
          {navItems.map((item, index) => renderNavItem(item, index))}
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
                {userRole === "admin" ? "Администратор" : userRole === "operator" ? "Оператор" : "Клиент"}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}