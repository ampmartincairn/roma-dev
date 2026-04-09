import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { useAuth } from "@/lib/AuthContext";

export default function Layout() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [role, setRole] = useState("client");

  const normalizeRole = (role) => {
    if (role === "user") return "client";
    if (role === "manager") return "operator";
    return role;
  };

  useEffect(() => {
    setRole(normalizeRole(user?.role) || "client");
  }, [user]);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={user}
        onLogout={logout}
      />
      <div className="lg:pl-64 min-h-screen flex flex-col">
        <TopBar onMenuClick={() => setSidebarOpen(true)} onLogout={logout} />
        <main className="flex-1 p-4 lg:p-6">
          <Outlet context={{ user, role }} />
        </main>
      </div>
    </div>
  );
}