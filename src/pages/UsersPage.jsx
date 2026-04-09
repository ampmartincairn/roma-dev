import { useState, useEffect } from "react";
import { db } from "@/api/base44Client";
import { Search, Users, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PageHeader from "../components/wms/PageHeader";
import EmptyState from "../components/wms/EmptyState";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showClientProducts, setShowClientProducts] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientProducts, setClientProducts] = useState([]);
  const [loadingClientProducts, setLoadingClientProducts] = useState(false);

  const normalizeRole = (role) => role === 'user' ? 'client' : role;

  const loadData = async () => {
    const data = await db.entities.User.list("-created_date", 200);
    setUsers(data.map((user) => ({ ...user, role: normalizeRole(user.role) })));
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const openClientProducts = async (client) => {
    setSelectedClient(client);
    setShowClientProducts(true);
    setLoadingClientProducts(true);

    try {
      const [products, inventory] = await Promise.all([
        db.entities.Product.filter({ client_email: client.email }, "name", 1000),
        db.entities.Inventory.filter({ client_email: client.email }, "-updated_date", 2000),
      ]);

      const qtyBySku = inventory.reduce((acc, row) => {
        const sku = row.sku;
        if (!sku) return acc;
        acc[sku] = (acc[sku] || 0) + Number(row.quantity || 0);
        return acc;
      }, {});

      const rows = products.map((p) => ({
        ...p,
        stock_qty: Number(qtyBySku[p.sku] || 0),
      }));

      setClientProducts(rows);
    } catch (error) {
      console.error("Ошибка загрузки товаров клиента:", error);
      setClientProducts([]);
    } finally {
      setLoadingClientProducts(false);
    }
  };

  const clients = users.filter((u) => normalizeRole(u.role || "client") === "client");

  const filtered = clients.filter((u) => {
    return !search ||
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.company_name?.toLowerCase().includes(search.toLowerCase());
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
      <PageHeader
        title="Клиенты"
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Поиск по имени или email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="Нет клиентов" description="Клиенты не найдены" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((u) => {
            return (
              <div key={u.id} className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-all hover:border-primary/20">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                    {u.full_name?.[0] || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{u.full_name || "Без имени"}</p>
                    <p className="text-sm text-muted-foreground truncate">{u.email}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <User className="h-3.5 w-3.5 text-wms-success" />
                      <span className="text-xs font-medium">Клиент</span>
                    </div>
                    {u.company_name && <p className="text-xs text-muted-foreground mt-1">{u.company_name}</p>}
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t">
                  <Button className="w-full" variant="outline" onClick={() => openClientProducts(u)}>
                    Посмотреть товары клиента
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showClientProducts} onOpenChange={setShowClientProducts}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Товары клиента: {selectedClient?.company_name || selectedClient?.full_name || selectedClient?.email}
            </DialogTitle>
          </DialogHeader>

          {loadingClientProducts ? (
            <div className="py-10 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          ) : clientProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">У клиента пока нет добавленных товаров</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Товар</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Артикул</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Штрихкод</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Кол-во на складе</th>
                  </tr>
                </thead>
                <tbody>
                  {clientProducts.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="py-3 px-4 font-medium">{p.name}</td>
                      <td className="py-3 px-4 text-muted-foreground">{p.sku || "-"}</td>
                      <td className="py-3 px-4 text-muted-foreground">{p.barcode || "-"}</td>
                      <td className="py-3 px-4 text-right font-semibold">{p.stock_qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </DialogContent>
      </Dialog>
    </div>
  );
}