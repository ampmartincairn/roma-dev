import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Search, History, ClipboardList, PackageCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "../components/wms/PageHeader";
import StatusBadge from "../components/wms/StatusBadge";
import MarketplaceBadge from "../components/wms/MarketplaceBadge";
import EmptyState from "../components/wms/EmptyState";
import moment from "moment";

export default function HistoryPage() {
  const { user, role } = useOutletContext();
  const [receptions, setReceptions] = useState([]);
  const [assemblies, setAssemblies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      const [r, a] = await Promise.all([
        base44.entities.ReceptionRequest.filter({ client_email: user?.email }, "-created_date", 100),
        base44.entities.AssemblyOrder.filter({ client_email: user?.email }, "-created_date", 100),
      ]);
      setReceptions(r);
      setAssemblies(a);
      setLoading(false);
    };
    if (user) load();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const filteredR = receptions.filter(r => !search || r.request_number?.toLowerCase().includes(search.toLowerCase()));
  const filteredA = assemblies.filter(a => !search || a.order_number?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <PageHeader title="История заявок" description="Все ваши заявки и заказы" />

      <div className="relative max-w-md mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Поиск по номеру..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Tabs defaultValue="receptions">
        <TabsList className="mb-4">
          <TabsTrigger value="receptions" className="gap-2"><ClipboardList className="h-4 w-4" /> Приёмка ({filteredR.length})</TabsTrigger>
          <TabsTrigger value="assemblies" className="gap-2"><PackageCheck className="h-4 w-4" /> Сборка ({filteredA.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="receptions">
          {filteredR.length === 0 ? (
            <EmptyState icon={History} title="Нет заявок" description="История приёмок пуста" />
          ) : (
            <div className="space-y-3">
              {filteredR.map((r) => (
                <div key={r.id} className="bg-card rounded-xl border p-4 hover:shadow-sm transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm">{r.request_number}</span>
                      <MarketplaceBadge marketplace={r.marketplace} />
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Склад: {r.warehouse}</span>
                    <span>Товаров: {r.items?.length || 0}</span>
                    <span>{moment(r.created_date).format("DD.MM.YYYY HH:mm")}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="assemblies">
          {filteredA.length === 0 ? (
            <EmptyState icon={History} title="Нет заказов" description="История сборок пуста" />
          ) : (
            <div className="space-y-3">
              {filteredA.map((a) => (
                <div key={a.id} className="bg-card rounded-xl border p-4 hover:shadow-sm transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm">{a.order_number}</span>
                      <MarketplaceBadge marketplace={a.marketplace} />
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Склад: {a.destination_warehouse}</span>
                    <span>Упаковка: {a.packaging_type}</span>
                    <span>{moment(a.created_date).format("DD.MM.YYYY HH:mm")}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}