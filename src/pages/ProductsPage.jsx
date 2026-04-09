import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { db } from "@/api/base44Client";
import { Plus, Search, Package, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PageHeader from "../components/wms/PageHeader";
import EmptyState from "../components/wms/EmptyState";
import { toast } from "sonner";

const generateCode128Barcode = () => {
  const timestamp = Date.now().toString().slice(-8);
  const randomDigits = Math.floor(Math.random() * 1e7).toString().padStart(7, "0");
  return `2${timestamp}${randomDigits}`.slice(0, 13);
};

export default function ProductsPage() {
  const { user, role } = useOutletContext();
  const [products, setProducts] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", sku: "", barcode: "", weight_kg: "", client_email: "", client_name: "" });
  const [saving, setSaving] = useState(false);
  const isClient = role === "client";
  const isClientActive = !isClient || user?.is_active === true;

  const getNextAutoSku = async () => {
    const allProducts = await db.entities.Product.list("-created_date", 2000);
    const usedSkus = new Set(
      allProducts
        .map((p) => String(p.sku || "").trim())
        .filter((sku) => /^\d{3}$/.test(sku))
    );

    for (let n = 1; n <= 999; n++) {
      const candidate = String(n).padStart(3, "0");
      if (!usedSkus.has(candidate)) {
        return candidate;
      }
    }

    throw new Error("Свободные артикулы закончились (001-999)");
  };

  const loadData = async () => {
    const isClient = role === "client";
    const productPromise = isClient
      ? db.entities.Product.filter({ client_email: user?.email }, "-created_date", 200)
      : db.entities.Product.list("-created_date", 200);

    const [data, allUsers] = await Promise.all([
      productPromise,
      role === "admin" ? db.entities.User.list("-created_date", 500) : Promise.resolve([]),
    ]);

    const normalizedClients = allUsers
      .filter((u) => {
        const normalizedRole = u.role === "user" ? "client" : u.role;
        return normalizedRole === "client";
      })
      .map((u) => ({
        id: u.id,
        email: u.email,
        name: u.company_name || u.full_name || u.email,
      }));

    setProducts(data);
    setClients(normalizedClients);
    setLoading(false);
  };

  useEffect(() => {
    if (user) loadData();
  }, [user, role]);

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name,
      sku: p.sku,
      barcode: p.barcode || "",
      weight_kg: p.weight_kg || "",
      client_email: p.client_email || "",
      client_name: p.client_name || ""
    });
    setShowForm(true);
  };

  const openCreate = async () => {
    if (isClient && !isClientActive) {
      toast.error("Аккаунт не активирован. Обратитесь к администратору.");
      return;
    }

    let autoSku = "";
    if (isClient) {
      try {
        autoSku = await getNextAutoSku();
      } catch (error) {
        toast.error(error?.message || "Не удалось назначить артикул");
        return;
      }
    }

    setEditing(null);
    setForm({
      name: "",
      sku: autoSku,
      barcode: "",
      weight_kg: "",
      client_email: role === "admin" ? "" : (user?.email || ""),
      client_name: role === "admin" ? "" : (user?.company_name || user?.full_name || "")
    });
    setShowForm(true);
  };

  const handleClientSelect = (clientEmail) => {
    const selectedClient = clients.find((c) => c.email === clientEmail);
    setForm((prev) => ({
      ...prev,
      client_email: clientEmail,
      client_name: selectedClient?.name || "",
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    if (isClient && !isClientActive) {
      toast.error("Аккаунт не активирован. Добавление товара недоступно.");
      setSaving(false);
      return;
    }

    if (role === "admin" && !form.client_email) {
      toast.error("Выберите клиента");
      setSaving(false);
      return;
    }

    let skuValue = form.sku?.trim();
    if (isClient && !editing) {
      try {
        skuValue = await getNextAutoSku();
      } catch (error) {
        toast.error(error?.message || "Не удалось назначить артикул");
        setSaving(false);
        return;
      }
    }

    if (!skuValue) {
      toast.error("Артикул обязателен");
      setSaving(false);
      return;
    }

    const data = {
      ...form,
      sku: skuValue,
      barcode: form.barcode?.trim() || generateCode128Barcode(),
      client_email: form.client_email || user?.email || "",
      client_name: form.client_name || user?.company_name || user?.full_name || form.client_email || "",
      weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : undefined,
    };

    const allProducts = await db.entities.Product.list("-created_date", 2000);
    const duplicateSku = allProducts.find((p) => {
      const sameSku = String(p.sku || "").trim().toLowerCase() === skuValue.toLowerCase();
      const sameRecord = editing ? p.id === editing.id : false;
      return sameSku && !sameRecord;
    });

    if (duplicateSku) {
      toast.error("Такой артикул уже используется другим клиентом");
      setSaving(false);
      return;
    }

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
      p.client_name?.toLowerCase().includes(search.toLowerCase()) ||
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
        actions={
          <Button onClick={openCreate} disabled={isClient && !isClientActive}>
            <Plus className="h-4 w-4 mr-2" /> Добавить товар
          </Button>
        }
      />

      {isClient && !isClientActive && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Добавление товаров недоступно, пока администратор не активирует ваш аккаунт.
        </div>
      )}

      <div className="relative max-w-md mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Поиск по названию, артикулу, клиенту..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Package} title="Нет товаров" description="Добавьте первый товар в каталог" />
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-auto">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">#</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">Название</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">Артикул</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">Клиент</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, index) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-medium whitespace-nowrap">{index + 1}</td>
                    <td className="py-3 px-4 font-medium">{p.name}</td>
                    <td className="py-3 px-4 font-mono text-xs text-muted-foreground whitespace-nowrap">{p.sku}</td>
                    <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">{p.client_name || p.client_email || "—"}</td>
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
              {role === "admin" && (
                <div className="space-y-2 col-span-2">
                  <Label>Клиент *</Label>
                  <Select value={form.client_email} onValueChange={handleClientSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите клиента" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.email}>
                          {client.name} ({client.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2"><Label>Наименование товара *</Label><Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} required /></div>
              <div className="space-y-2">
                <Label>Артикул *</Label>
                <Input
                  value={form.sku}
                  onChange={(e) => setForm(p => ({ ...p, sku: e.target.value }))}
                  required
                  readOnly={isClient && !editing}
                  placeholder={isClient && !editing ? "Присваивается автоматически" : "Введите артикул"}
                />
              </div>
              <div className="space-y-2"><Label>Штрих-код</Label><Input value={form.barcode} onChange={(e) => setForm(p => ({ ...p, barcode: e.target.value }))} placeholder="Можно оставить пустым" /></div>
              <div className="space-y-2"><Label>Вес (кг)</Label><Input type="number" step="0.01" value={form.weight_kg} onChange={(e) => setForm(p => ({ ...p, weight_kg: e.target.value }))} /></div>
            </div>
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