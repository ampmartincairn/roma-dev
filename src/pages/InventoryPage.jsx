import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { db } from "@/api/base44Client";
import { Search, Warehouse, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import PageHeader from "../components/wms/PageHeader";
import EmptyState from "../components/wms/EmptyState";
import { toast } from "sonner";

export default function InventoryPage() {
  const { user, role } = useOutletContext();
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);

  useEffect(() => {
    const load = async () => {
      const isClient = role === "client";
      const data = isClient
        ? await db.entities.Inventory.filter({ client_email: user?.email }, "-updated_date", 200)
        : await db.entities.Inventory.list("-updated_date", 200);
      setInventory(data);
      setLoading(false);
    };
    if (user) load();
  }, [user, role]);

  const filtered = inventory.filter((i) => {
    return !search ||
      i.product_name?.toLowerCase().includes(search.toLowerCase()) ||
      i.sku?.toLowerCase().includes(search.toLowerCase());
  });

  const totalQty = filtered.reduce((s, i) => s + (i.quantity || 0), 0);
  const totalReserved = filtered.reduce((s, i) => s + (i.reserved || 0), 0);

  const handleDeleteInventoryItem = async () => {
    if (!itemToDelete) return;
    setDeletingId(itemToDelete.id);
    try {
      await db.entities.Inventory.delete(itemToDelete.id);
      setInventory((prev) => prev.filter((row) => row.id !== itemToDelete.id));
      toast.success("Позиция удалена из складских остатков");
      setItemToDelete(null);
    } catch (error) {
      console.error("Error deleting inventory item:", error);
      toast.error("Не удалось удалить позицию");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Складские остатки" description="Текущие остатки товаров по складам" />

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Поиск по товару или артикулу..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="bg-card rounded-xl border p-4 text-center">
          <p className="text-2xl font-bold">{filtered.length}</p>
          <p className="text-xs text-muted-foreground">Позиций</p>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <p className="text-2xl font-bold">{totalQty}</p>
          <p className="text-xs text-muted-foreground">Всего единиц</p>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <p className="text-2xl font-bold text-wms-warning">{totalReserved}</p>
          <p className="text-xs text-muted-foreground">Зарезервировано</p>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Warehouse} title="Нет остатков" description="На складе пока нет товаров" />
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Товар</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Артикул</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Склад</th>
                  {role !== "client" && <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden lg:table-cell">Клиент</th>}
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Кол-во</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Резерв</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Доступно</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => (
                  <tr key={i.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-medium">{i.product_name}</td>
                    <td className="py-3 px-4 text-muted-foreground font-mono text-xs">{i.sku}</td>
                    <td className="py-3 px-4 hidden md:table-cell text-muted-foreground">{i.warehouse}</td>
                    {role !== "client" && <td className="py-3 px-4 hidden lg:table-cell text-muted-foreground">{i.client_email}</td>}
                    <td className="py-3 px-4 text-right font-medium">{i.quantity}</td>
                    <td className="py-3 px-4 text-right text-wms-warning font-medium">{i.reserved || 0}</td>
                    <td className="py-3 px-4 text-right text-wms-success font-bold">{(i.quantity || 0) - (i.reserved || 0)}</td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        disabled={deletingId === i.id}
                        onClick={() => setItemToDelete(i)}
                        title="Удалить позицию"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить позицию из остатков?</AlertDialogTitle>
            <AlertDialogDescription>
              Будет удалена позиция {itemToDelete?.product_name || "товара"} (SKU: {itemToDelete?.sku || "—"}).
              Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingId}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              disabled={!!deletingId}
              onClick={(e) => {
                e.preventDefault();
                handleDeleteInventoryItem();
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deletingId ? "Удаление..." : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}