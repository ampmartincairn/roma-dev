import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";

export default function ReceptionForm({ onSubmit, onCancel, loading }) {
  const [form, setForm] = useState({
    marketplace: "",
    warehouse: "",
    comment: "",
    items: [{ product_name: "", sku: "", expected_qty: 1, barcode: "" }],
  });

  const addItem = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { product_name: "", sku: "", expected_qty: 1, barcode: "" }],
    }));
  };

  const removeItem = (idx) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
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
    onSubmit(form);
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
          <Label>Склад *</Label>
          <Select value={form.warehouse} onValueChange={(v) => setForm(p => ({ ...p, warehouse: v }))}>
            <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Основной склад">Основной склад</SelectItem>
              <SelectItem value="Склад WB">Склад WB</SelectItem>
              <SelectItem value="Склад Ozon">Склад Ozon</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <Label className="text-base font-semibold">Товары</Label>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="h-4 w-4 mr-1" /> Добавить
          </Button>
        </div>
        <div className="space-y-3">
          {form.items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-end p-3 bg-muted/50 rounded-lg">
              <div className="col-span-12 sm:col-span-4 space-y-1">
                <Label className="text-xs">Название</Label>
                <Input
                  value={item.product_name}
                  onChange={(e) => updateItem(idx, "product_name", e.target.value)}
                  placeholder="Товар"
                  required
                />
              </div>
              <div className="col-span-5 sm:col-span-3 space-y-1">
                <Label className="text-xs">Артикул</Label>
                <Input
                  value={item.sku}
                  onChange={(e) => updateItem(idx, "sku", e.target.value)}
                  placeholder="SKU"
                  required
                />
              </div>
              <div className="col-span-4 sm:col-span-2 space-y-1">
                <Label className="text-xs">Кол-во</Label>
                <Input
                  type="number"
                  min={1}
                  value={item.expected_qty}
                  onChange={(e) => updateItem(idx, "expected_qty", parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="col-span-12 sm:col-span-2 space-y-1">
                <Label className="text-xs">Штрих-код</Label>
                <Input
                  value={item.barcode}
                  onChange={(e) => updateItem(idx, "barcode", e.target.value)}
                  placeholder="Штрих-код"
                />
              </div>
              <div className="col-span-3 sm:col-span-1 flex justify-end">
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
        <Button type="submit" disabled={loading || !form.marketplace || !form.warehouse}>
          {loading ? "Создание..." : "Создать заявку"}
        </Button>
      </div>
    </form>
  );
}