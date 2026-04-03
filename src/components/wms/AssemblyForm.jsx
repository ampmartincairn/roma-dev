import { useState, useEffect } from "react";
import { db } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";

export default function AssemblyForm({ onSubmit, onCancel, loading, userEmail }) {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    marketplace: "",
    destination_warehouse: "",
    packaging_type: "",
    comment: "",
    items: [{ product_name: "", sku: "", quantity: 1, honest_mark: "", _productId: "" }],
  });

  useEffect(() => {
    if (!userEmail) return;
    db.entities.Inventory.filter({ client_email: userEmail }, "product_name", 500)
      .then(inv => setProducts(inv.filter(i => (i.quantity || 0) > 0)));
  }, [userEmail]);

  const addItem = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { product_name: "", sku: "", quantity: 1, honest_mark: "", _productId: "" }],
    }));
  };

  const removeItem = (idx) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  };

  const selectProduct = (idx, productId) => {
    const p = products.find(p => p.id === productId);
    if (!p) return;
    setForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === idx ? { ...item, product_name: p.product_name, sku: p.sku, _productId: productId } : item
      ),
    }));
  };

  const updateItem = (idx, field, value) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === idx ? { ...item, [field]: value } : item),
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const clean = { ...form, items: form.items.map(({ _productId, ...rest }) => rest) };
    onSubmit(clean);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Маркетплейс *</Label>
          <Select value={form.marketplace} onValueChange={(v) => setForm(p => ({ ...p, marketplace: v }))}>
            <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="WB">Wildberries</SelectItem>
              <SelectItem value="Ozon">Ozon</SelectItem>
              <SelectItem value="Другое">Другое</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Склад назначения *</Label>
          <Input
            value={form.destination_warehouse}
            onChange={(e) => setForm(p => ({ ...p, destination_warehouse: e.target.value }))}
            placeholder="Например: Коледино, Хоругвино"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Тип упаковки *</Label>
        <Select value={form.packaging_type} onValueChange={(v) => setForm(p => ({ ...p, packaging_type: v }))}>
          <SelectTrigger><SelectValue placeholder="Выберите тип упаковки" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="zip-пакет">Zip-пакет</SelectItem>
            <SelectItem value="маленькая коробка">Маленькая коробка</SelectItem>
            <SelectItem value="средняя коробка">Средняя коробка</SelectItem>
            <SelectItem value="большая коробка">Большая коробка</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <Label className="text-base font-semibold">Товары для сборки</Label>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="h-4 w-4 mr-1" /> Добавить
          </Button>
        </div>
        <div className="space-y-3">
          {form.items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-end p-3 bg-muted/50 rounded-lg">
              <div className="col-span-12 sm:col-span-4 space-y-1">
                <Label className="text-xs">Товар *</Label>
                <Select value={item._productId || ""} onValueChange={(v) => selectProduct(idx, v)} disabled={products.length === 0}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={products.length === 0 ? "Нет товаров на складе" : "Выберите товар"} />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="font-medium">{p.product_name}</span>
                          <span className="text-muted-foreground ml-1 text-xs">({p.sku}) — {p.quantity} шт.</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
              </div>

              <div className="col-span-5 sm:col-span-3 space-y-1">
                <Label className="text-xs">Артикул</Label>
                <Input
                  value={item.sku}
                  onChange={(e) => updateItem(idx, "sku", e.target.value)}
                  placeholder="SKU"
                  required
                  readOnly={!!item._productId}
                  className={item._productId ? "bg-muted text-muted-foreground cursor-not-allowed" : ""}
                />
              </div>

              <div className="col-span-3 sm:col-span-2 space-y-1">
                <Label className="text-xs">Кол-во</Label>
                <Input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 1)}
                />
              </div>

              <div className="col-span-11 sm:col-span-2 space-y-1">
                <Label className="text-xs">Честный знак</Label>
                <Input
                  value={item.honest_mark}
                  onChange={(e) => updateItem(idx, "honest_mark", e.target.value)}
                  placeholder="Код маркировки"
                />
              </div>

              <div className="col-span-1 flex justify-end items-end pb-0.5">
                {form.items.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(idx)} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Комментарий</Label>
        <Textarea
          value={form.comment}
          onChange={(e) => setForm(p => ({ ...p, comment: e.target.value }))}
          placeholder="Дополнительная информация..."
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Отмена</Button>
        <Button type="submit" disabled={loading || !form.marketplace || !form.destination_warehouse || !form.packaging_type}>
          {loading ? "Создание..." : "Создать заказ"}
        </Button>
      </div>
    </form>
  );
}