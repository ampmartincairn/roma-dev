import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { db } from "@/api/base44Client";
import { Plus, Search, Package, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PageHeader from "../components/wms/PageHeader";
import EmptyState from "../components/wms/EmptyState";
import { toast } from "sonner";

export default function ProductsPage() {
  const { user } = useOutletContext();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", sku: "", barcode: "", category: "", weight_kg: "", dimensions: "", client_email: "" });
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    const data = await db.entities.Product.list("-created_date", 200);
    setProducts(data);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const openEdit = (p) => {
    setEditing(p);
    setForm({ name: p.name, sku: p.sku, barcode: p.barcode || "", category: p.category || "", weight_kg: p.weight_kg || "", dimensions: p.dimensions || "", client_email: p.client_email });
    setShowForm(true);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", sku: "", barcode: "", category: "", weight_kg: "", dimensions: "", client_email: "" });
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const data = { ...form, weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : undefined };
    if (editing) {
      await db.entities.Product.update(editing.id, data);
      toast.success("Товар обновлён");
    } else {
      await db.entities.Product.create(data);
      toast.success("Товар добавлен");
    }
    setSaving(false);
    setShowForm(false);
    loadData();
  };

  const handleDelete = async (p) => {
    if (!confirm(`Удалить товар "${p.name}"?`)) return;
    await db.entities.Product.delete(p.id);
    toast.success("Товар удалён");
    loadData();
  };

  const filtered = products.filter((p) => {
    return !search ||
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase()) ||
      p.client_email?.toLowerCase().includes(search.toLowerCase());
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
        title="Товары"
        description="Каталог товаров на складе"
        actions={<Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Добавить товар</Button>}
      />

      <div className="relative max-w-md mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Поиск по названию, артикулу, клиенту..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Package} title="Нет товаров" description="Добавьте первый товар в каталог" />
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Название</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">SKU</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Категория</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden lg:table-cell">Клиент</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-medium">{p.name}</td>
                    <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{p.sku}</td>
                    <td className="py-3 px-4 hidden md:table-cell text-muted-foreground">{p.category || "—"}</td>
                    <td className="py-3 px-4 hidden lg:table-cell text-muted-foreground">{p.client_email}</td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(p)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Редактировать товар" : "Новый товар"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Название *</Label><Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} required /></div>
              <div className="space-y-2"><Label>Артикул *</Label><Input value={form.sku} onChange={(e) => setForm(p => ({ ...p, sku: e.target.value }))} required /></div>
              <div className="space-y-2"><Label>Штрих-код</Label><Input value={form.barcode} onChange={(e) => setForm(p => ({ ...p, barcode: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Категория</Label><Input value={form.category} onChange={(e) => setForm(p => ({ ...p, category: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Вес (кг)</Label><Input type="number" step="0.01" value={form.weight_kg} onChange={(e) => setForm(p => ({ ...p, weight_kg: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Габариты</Label><Input value={form.dimensions} onChange={(e) => setForm(p => ({ ...p, dimensions: e.target.value }))} placeholder="ДxШxВ" /></div>
            </div>
            <div className="space-y-2"><Label>Email клиента *</Label><Input type="email" value={form.client_email} onChange={(e) => setForm(p => ({ ...p, client_email: e.target.value }))} required /></div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Отмена</Button>
              <Button type="submit" disabled={saving}>{saving ? "Сохранение..." : "Сохранить"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}