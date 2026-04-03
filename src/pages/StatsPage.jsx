import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { db } from "@/api/base44Client";
import { BarChart3, ClipboardList, PackageCheck, Truck, Warehouse } from "lucide-react";
import PageHeader from "../components/wms/PageHeader";
import StatsCard from "../components/wms/StatsCard";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["hsl(222,80%,45%)", "hsl(142,72%,42%)", "hsl(38,92%,50%)", "hsl(280,65%,60%)", "hsl(0,84%,60%)", "hsl(199,89%,48%)", "hsl(340,75%,55%)"];

export default function StatsPage() {
  const { user } = useOutletContext();
  const [receptions, setReceptions] = useState([]);
  const [assemblies, setAssemblies] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [r, a, i] = await Promise.all([
        db.entities.ReceptionRequest.list("-created_date", 200),
        db.entities.AssemblyOrder.list("-created_date", 200),
        db.entities.Inventory.list("-created_date", 500),
      ]);
      setReceptions(r);
      setAssemblies(a);
      setInventory(i);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const receptionsByStatus = ["новая", "в обработке", "принята", "отменена"].map(s => ({
    name: s, value: receptions.filter(r => r.status === s).length
  })).filter(d => d.value > 0);

  const assembliesByStatus = ["новая", "в обработке", "в комплектовке", "упакована", "отгружена", "отменена"].map(s => ({
    name: s, value: assemblies.filter(a => a.status === s).length
  })).filter(d => d.value > 0);

  const mpData = [
    { name: "WB", приёмка: receptions.filter(r => r.marketplace === "WB").length, сборка: assemblies.filter(a => a.marketplace === "WB").length },
    { name: "Ozon", приёмка: receptions.filter(r => r.marketplace === "Ozon").length, сборка: assemblies.filter(a => a.marketplace === "Ozon").length },
    { name: "Другое", приёмка: receptions.filter(r => r.marketplace === "Другое").length, сборка: assemblies.filter(a => a.marketplace === "Другое").length },
  ];

  const totalInventory = inventory.reduce((s, i) => s + (i.quantity || 0), 0);

  return (
    <div>
      <PageHeader title="Статистика" description="Аналитика по операциям склада" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard title="Заявок на приёмку" value={receptions.length} icon={ClipboardList} />
        <StatsCard title="Заказов на сборку" value={assemblies.length} icon={PackageCheck} />
        <StatsCard title="Отгружено" value={assemblies.filter(a => a.status === "отгружена").length} icon={Truck} />
        <StatsCard title="Товаров на складе" value={totalInventory} icon={Warehouse} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-card rounded-xl border p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" /> По маркетплейсам</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={mpData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="приёмка" fill="hsl(222,80%,45%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="сборка" fill="hsl(142,72%,42%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-xl border p-5">
          <h3 className="font-semibold mb-4">Приёмка по статусам</h3>
          {receptionsByStatus.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Нет данных</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={receptionsByStatus} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {receptionsByStatus.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-card rounded-xl border p-5">
        <h3 className="font-semibold mb-4">Сборка по статусам</h3>
        {assembliesByStatus.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">Нет данных</p>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={assembliesByStatus} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                {assembliesByStatus.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}