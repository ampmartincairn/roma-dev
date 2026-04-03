import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ClipboardList, PackageCheck, Truck, Warehouse, Package, TrendingUp } from "lucide-react";
import StatsCard from "../components/wms/StatsCard";
import StatusBadge from "../components/wms/StatusBadge";
import MarketplaceBadge from "../components/wms/MarketplaceBadge";
import PageHeader from "../components/wms/PageHeader";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function Dashboard() {
  const { user, role } = useOutletContext();
  const [receptions, setReceptions] = useState([]);
  const [assemblies, setAssemblies] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const isClient = role === "client";
      const filter = isClient ? { client_email: user?.email } : {};

      const [r, a, i] = await Promise.all([
        isClient
          ? base44.entities.ReceptionRequest.filter(filter, "-created_date", 50)
          : base44.entities.ReceptionRequest.list("-created_date", 50),
        isClient
          ? base44.entities.AssemblyOrder.filter(filter, "-created_date", 50)
          : base44.entities.AssemblyOrder.list("-created_date", 50),
        isClient
          ? base44.entities.Inventory.filter(filter, "-created_date", 100)
          : base44.entities.Inventory.list("-created_date", 100),
      ]);
      setReceptions(r);
      setAssemblies(a);
      setInventory(i);
      setLoading(false);
    };
    if (user) load();
  }, [user, role]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const newReceptions = receptions.filter(r => r.status === "новая").length;
  const inProgressAssemblies = assemblies.filter(a => ["в обработке", "в комплектовке"].includes(a.status)).length;
  const shippedAssemblies = assemblies.filter(a => a.status === "отгружена").length;
  const totalInventory = inventory.reduce((sum, i) => sum + (i.quantity || 0), 0);

  const recentReceptions = receptions.slice(0, 5);
  const recentAssemblies = assemblies.slice(0, 5);

  const chartData = [
    { name: "Новые", приёмка: receptions.filter(r => r.status === "новая").length, сборка: assemblies.filter(a => a.status === "новая").length },
    { name: "В работе", приёмка: receptions.filter(r => r.status === "в обработке").length, сборка: assemblies.filter(a => ["в обработке", "в комплектовке"].includes(a.status)).length },
    { name: "Готово", приёмка: receptions.filter(r => r.status === "принята").length, сборка: assemblies.filter(a => a.status === "упакована").length },
    { name: "Отгружено", приёмка: 0, сборка: shippedAssemblies },
  ];

  return (
    <div>
      <PageHeader
        title={`Добро пожаловать, ${user?.full_name || "Пользователь"}`}
        description={
          role === "admin"
            ? "Обзор всех операций склада"
            : role === "operator"
            ? "Панель оператора склада"
            : "Ваш личный кабинет"
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard title="Заявки на приёмку" value={receptions.length} icon={ClipboardList} trendLabel={`${newReceptions} новых`} trend={newReceptions > 0 ? 1 : 0} />
        <StatsCard title="Заказы на сборку" value={assemblies.length} icon={PackageCheck} trendLabel={`${inProgressAssemblies} в работе`} trend={inProgressAssemblies > 0 ? 1 : 0} />
        <StatsCard title="Отгружено" value={shippedAssemblies} icon={Truck} />
        <StatsCard title="Остатки на складе" value={totalInventory} icon={Warehouse} trendLabel="единиц товара" />
      </div>

      {/* Chart + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Chart */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Статистика по статусам</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
              <XAxis dataKey="name" fontSize={12} tickLine={false} />
              <YAxis fontSize={12} tickLine={false} />
              <Tooltip />
              <Bar dataKey="приёмка" fill="hsl(222 80% 45%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="сборка" fill="hsl(142 72% 42%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Receptions */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold mb-4">Последние заявки на приёмку</h3>
          {recentReceptions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Нет заявок</p>
          ) : (
            <div className="space-y-3">
              {recentReceptions.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-primary/5">
                      <Package className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{r.request_number}</p>
                      <p className="text-xs text-muted-foreground">{r.client_name || r.client_email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <MarketplaceBadge marketplace={r.marketplace} />
                    <StatusBadge status={r.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Assembly Orders */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-semibold mb-4">Последние заказы на сборку</h3>
        {recentAssemblies.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Нет заказов</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Номер</th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground hidden sm:table-cell">Клиент</th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Маркетплейс</th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Статус</th>
                </tr>
              </thead>
              <tbody>
                {recentAssemblies.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="py-3 px-2 font-medium">{a.order_number}</td>
                    <td className="py-3 px-2 hidden sm:table-cell text-muted-foreground">{a.client_name || a.client_email}</td>
                    <td className="py-3 px-2"><MarketplaceBadge marketplace={a.marketplace} /></td>
                    <td className="py-3 px-2"><StatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}