import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Search, Truck } from "lucide-react";
import { Input } from "@/components/ui/input";
import PageHeader from "../components/wms/PageHeader";
import StatusBadge from "../components/wms/StatusBadge";
import MarketplaceBadge from "../components/wms/MarketplaceBadge";
import EmptyState from "../components/wms/EmptyState";
import moment from "moment";

export default function ShipmentsPage() {
  const { user, role } = useOutletContext();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      const all = role === "client"
        ? await base44.entities.AssemblyOrder.filter({ client_email: user?.email }, "-created_date", 100)
        : await base44.entities.AssemblyOrder.list("-created_date", 100);
      setOrders(all.filter(o => ["упакована", "отгружена"].includes(o.status)));
      setLoading(false);
    };
    if (user) load();
  }, [user, role]);

  const filtered = orders.filter((o) => {
    return !search ||
      o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
      o.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.destination_warehouse?.toLowerCase().includes(search.toLowerCase());
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Отгрузки" description="Заказы готовые к отгрузке и отгруженные" />

      <div className="relative max-w-md mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Поиск..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Truck} title="Нет отгрузок" description="Нет заказов, готовых к отгрузке" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((o) => (
            <div key={o.id} className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-all hover:border-primary/20">
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-sm">{o.order_number}</span>
                <StatusBadge status={o.status} />
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Клиент</span>
                  <span className="font-medium">{o.client_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Маркетплейс</span>
                  <MarketplaceBadge marketplace={o.marketplace} />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Склад</span>
                  <span className="font-medium">{o.destination_warehouse}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Упаковка</span>
                  <span>{o.packaging_type}</span>
                </div>
                {o.shipped_date && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Дата отгрузки</span>
                    <span>{moment(o.shipped_date).format("DD.MM.YYYY HH:mm")}</span>
                  </div>
                )}
                <div className="pt-2 border-t">
                  <span className="text-xs text-muted-foreground">Товаров: {o.items?.length || 0} позиций</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}