import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { db } from "@/api/base44Client";
import { Plus, Search, Filter, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import PageHeader from "../components/wms/PageHeader";
import StatusBadge from "../components/wms/StatusBadge";
import MarketplaceBadge from "../components/wms/MarketplaceBadge";
import EmptyState from "../components/wms/EmptyState";
import AssemblyForm from "../components/wms/AssemblyForm";
import StatusStepper from "../components/wms/StatusStepper";
import PrintDocumentsMenu from "../components/wms/PrintDocuments";
import { toast } from "sonner";

const normalizeAssemblyStatus = (status) => {
  const normalized = status?.trim().toLowerCase();
  const aliases = {
    "отгружена": "отгружено",
    "в обработке": "взята в работу",
    "в комплектовке": "упаковано",
    "упакована": "упаковано",
    "собрана": "собрано",
  };
  return aliases[normalized] || normalized;
};

const isAssemblyOrderClosed = (status) => {
  const normalized = normalizeAssemblyStatus(status);
  return normalized === "отгружено" || normalized === "отменена";
};

// Резервирует товары при создании заявки
const reserveInventoryForOrder = async (order) => {
  const requestedBySku = (order.items || []).reduce((acc, item) => {
    if (!item?.sku) return acc;
    acc[item.sku] = (acc[item.sku] || 0) + Number(item.quantity || 0);
    return acc;
  }, {});

  for (const [sku, requested] of Object.entries(requestedBySku)) {
    let remaining = Number(requested || 0);
    const inventoryRows = await db.entities.Inventory.filter(
      { client_email: order.client_email, sku },
      "-updated_date",
      500
    );

    for (const row of inventoryRows) {
      if (remaining <= 0) break;

      const currentQty = Number(row.quantity || 0);
      const currentReserved = Number(row.reserved || 0);
      const free = Math.max(0, currentQty - currentReserved);
      
      if (free <= 0) continue;

      const toReserve = Math.min(free, remaining);
      await db.entities.Inventory.update(row.id, {
        reserved: currentReserved + toReserve,
      });
      remaining -= toReserve;
    }
  }
};

// Освобождает резервирование при отмене заявки
const releaseReservationForOrder = async (order) => {
  const requestedBySku = (order.items || []).reduce((acc, item) => {
    if (!item?.sku) return acc;
    acc[item.sku] = (acc[item.sku] || 0) + Number(item.quantity || 0);
    return acc;
  }, {});

  for (const [sku, requested] of Object.entries(requestedBySku)) {
    let remaining = Number(requested || 0);
    const inventoryRows = await db.entities.Inventory.filter(
      { client_email: order.client_email, sku },
      "-updated_date",
      500
    );

    for (const row of inventoryRows) {
      if (remaining <= 0) break;

      const currentReserved = Number(row.reserved || 0);
      if (currentReserved <= 0) continue;

      const toRelease = Math.min(currentReserved, remaining);
      await db.entities.Inventory.update(row.id, {
        reserved: currentReserved - toRelease,
      });
      remaining -= toRelease;
    }
  }
};

// Списывает товары при отгрузке (уменьшает quantity и reserved)
const deductShippedItemsFromInventory = async (order) => {
  const requestedBySku = (order.items || []).reduce((acc, item) => {
    if (!item?.sku) return acc;
    acc[item.sku] = (acc[item.sku] || 0) + Number(item.quantity || 0);
    return acc;
  }, {});

  for (const [sku, requested] of Object.entries(requestedBySku)) {
    let remaining = Number(requested || 0);
    const inventoryRows = await db.entities.Inventory.filter(
      { client_email: order.client_email, sku },
      "-updated_date",
      500
    );

    const totalAvailable = inventoryRows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    if (totalAvailable < remaining) {
      throw new Error(`Недостаточно остатка для списания SKU ${sku}`);
    }

    for (const row of inventoryRows) {
      if (remaining <= 0) break;

      const currentQty = Number(row.quantity || 0);
      const currentReserved = Number(row.reserved || 0);
      
      if (currentQty <= 0) continue;

      const deducted = Math.min(currentQty, remaining);
      const releaseReserved = Math.min(deducted, currentReserved);
      
      const nextQuantity = currentQty - deducted;
      const nextReserved = Math.max(0, currentReserved - releaseReserved);

      if (nextQuantity <= 0 && nextReserved <= 0) {
        await db.entities.Inventory.delete(row.id);
      } else {
        await db.entities.Inventory.update(row.id, {
          quantity: nextQuantity,
          reserved: nextReserved,
        });
      }
      remaining -= deducted;
    }
  }
};

export default function AssemblyOrders() {
  const { user, role } = useOutletContext();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [operatorComment, setOperatorComment] = useState("");

  const loadData = async () => {
    const isClient = role === "client";
    const data = isClient
      ? await db.entities.AssemblyOrder.filter({ client_email: user?.email }, "-created_date", 100)
      : await db.entities.AssemblyOrder.list("-created_date", 100);
    setOrders(data);
    setLoading(false);
  };

  useEffect(() => {
    if (user) loadData();
  }, [user, role]);

  const handleCreate = async (form) => {
    setCreating(true);
    const num = "СБ-" + Date.now().toString(36).toUpperCase();
    try {
      await db.entities.AssemblyOrder.create({
        order_number: num,
        client_email: user.email,
        client_name: user.full_name,
        status: "новая",
        marketplace: form.marketplace,
        destination_warehouse: form.destination_warehouse,
        packaging_type: form.packaging_type,
        comment: form.comment,
        items: form.items,
      });

      // Резервируем товары для нового заказа
      const newOrder = (await db.entities.AssemblyOrder.filter(
        { client_email: user.email, order_number: num },
        "-created_date",
        1
      ))[0];
      
      if (newOrder) {
        await reserveInventoryForOrder(newOrder);
      }

      await db.entities.ActionLog.create({
        user_email: user.email,
        user_name: user.full_name,
        action: "Создан заказ на сборку",
        entity_type: "AssemblyOrder",
        details: `Номер: ${num}`,
      });
      toast.success("Заказ на сборку создан");
      setShowCreate(false);
    } catch (error) {
      console.error("Error creating assembly order:", error);
      toast.error("Не удалось создать заказ");
    } finally {
      setCreating(false);
      loadData();
    }
  };

  const handleStatusChange = async (order, newStatus) => {
    setActionLoading(true);
    try {
      const freshOrder = await db.entities.AssemblyOrder.get(order.id);
      const currentStatus = normalizeAssemblyStatus(freshOrder?.status);
      const normalizedNewStatus = normalizeAssemblyStatus(newStatus);
      const wasAlreadyShipped = currentStatus === "отгружено";

      // Если отмена заявки (и она ещё не отгружена) - освобождаем резервирование
      if (normalizedNewStatus === "отменена" && !wasAlreadyShipped) {
        await releaseReservationForOrder(freshOrder || order);
      }

      // Если отгрузка (и она ещё не отгружена) - списываем товары со склада
      if (normalizedNewStatus === "отгружено" && !wasAlreadyShipped) {
        await deductShippedItemsFromInventory(freshOrder || order);
      }

      const updateData = {
        status: normalizedNewStatus,
        operator_comment: operatorComment || order.operator_comment,
        processed_by: user.email,
      };
      if (normalizedNewStatus === "отгружено") {
        updateData.shipped_date = new Date().toISOString();
      }
      await db.entities.AssemblyOrder.update(order.id, updateData);
      await db.entities.ActionLog.create({
        user_email: user.email,
        user_name: user.full_name,
        action: `Статус заказа изменён на "${newStatus}"`,
        entity_type: "AssemblyOrder",
        entity_id: order.id,
        details: `Заказ ${order.order_number}`,
      });
      toast.success(`Статус: "${newStatus}"`);
      setActionLoading(false);
      setSelectedOrder(prev => ({ ...prev, ...updateData }));
      loadData();
    } catch (error) {
      console.error("Error updating assembly order status:", error);
      toast.error("Не удалось обновить статус");
      setActionLoading(false);
    }
  };

  const filtered = orders.filter((o) => {
    const normalizedStatus = normalizeAssemblyStatus(o.status);
    const matchSearch = !search ||
      o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
      o.client_name?.toLowerCase().includes(search.toLowerCase());

    let matchStatus = true;
    if (statusFilter === "active") {
      matchStatus = !isAssemblyOrderClosed(normalizedStatus);
    } else if (statusFilter !== "all") {
      matchStatus = normalizedStatus === normalizeAssemblyStatus(statusFilter);
    }

    return matchSearch && matchStatus;
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
        title="Заказы на сборку"
        description="Управление заказами на сборку и комплектацию"
        actions={
          role !== "operator" && (
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" /> Новый заказ
            </Button>
          )
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Поиск..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-52">
            <Filter className="h-4 w-4 mr-2" /><SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Активные (в работе)</SelectItem>
            <SelectItem value="новая">Новые</SelectItem>
            <SelectItem value="взята в работу">Взята в работу</SelectItem>
            <SelectItem value="упаковано">Упаковано</SelectItem>
            <SelectItem value="собрано">Собрано</SelectItem>
            <SelectItem value="готова к отгрузке">Готова к отгрузке</SelectItem>
            <SelectItem value="отгружено">Отгруженные</SelectItem>
            <SelectItem value="отменена">Отменённые</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title={statusFilter === "active" ? "Нет активных заказов" : "Нет заказов"}
          description={statusFilter === "active" ? "Все заказы обработаны — переключите фильтр для просмотра истории" : "Создайте заказ на сборку и комплектацию"}
        />
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Номер</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Клиент</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">МП</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden sm:table-cell">Упаковка</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Статус</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-medium">{o.order_number}</td>
                    <td className="py-3 px-4 hidden md:table-cell text-muted-foreground">{o.client_name || o.client_email}</td>
                    <td className="py-3 px-4"><MarketplaceBadge marketplace={o.marketplace} /></td>
                    <td className="py-3 px-4 hidden sm:table-cell text-muted-foreground">{o.packaging_type}</td>
                    <td className="py-3 px-4"><StatusBadge status={o.status} /></td>
                    <td className="py-3 px-4">
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedOrder(o); setOperatorComment(o.operator_comment || ""); }}>
                        Открыть
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Новый заказ на сборку</DialogTitle></DialogHeader>
          <AssemblyForm onSubmit={handleCreate} onCancel={() => setShowCreate(false)} loading={creating} userEmail={user?.email} />
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => { setSelectedOrder(null); setOperatorComment(""); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedOrder && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  {selectedOrder.order_number}
                  <StatusBadge status={selectedOrder.status} />
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5">
                {/* Meta */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-muted-foreground text-xs">Клиент</p><p className="font-medium">{selectedOrder.client_name}</p></div>
                  <div><p className="text-muted-foreground text-xs">Маркетплейс</p><MarketplaceBadge marketplace={selectedOrder.marketplace} /></div>
                  <div><p className="text-muted-foreground text-xs">Склад назначения</p><p className="font-medium">{selectedOrder.destination_warehouse}</p></div>
                  <div><p className="text-muted-foreground text-xs">Упаковка</p><p className="font-medium">{selectedOrder.packaging_type}</p></div>
                  {selectedOrder.comment && (
                    <div className="col-span-2"><p className="text-muted-foreground text-xs">Комментарий</p><p>{selectedOrder.comment}</p></div>
                  )}
                </div>

                {/* Items */}
                {selectedOrder.items?.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Товары для сборки</h4>
                    <div className="space-y-2">
                      {selectedOrder.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg text-sm">
                          <div>
                            <p className="font-medium">{item.product_name}</p>
                            <p className="text-xs text-muted-foreground">SKU: {item.sku}{item.honest_mark && ` | ЧЗ: ${item.honest_mark}`}</p>
                          </div>
                          <span className="font-semibold">{item.quantity} шт.</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status stepper for operators */}
                {(role === "operator" || role === "admin") && !isAssemblyOrderClosed(selectedOrder.status) && (
                  <div className="space-y-3 pt-3 border-t">
                    <h4 className="font-semibold text-sm">Смена статуса</h4>
                    <StatusStepper
                      status={selectedOrder.status}
                      type="assembly"
                      onNext={(next) => handleStatusChange(selectedOrder, next)}
                      onCancel={() => handleStatusChange(selectedOrder, "отменена")}
                      loading={actionLoading}
                    />
                    <div className="space-y-1.5">
                      <Label className="text-xs">Комментарий оператора</Label>
                      <Textarea value={operatorComment} onChange={(e) => setOperatorComment(e.target.value)} placeholder="Примечания..." rows={2} />
                    </div>
                  </div>
                )}

                {/* Print section — visible for operators and admins */}
                {(role === "operator" || role === "admin") && (
                  <div className="pt-3 border-t">
                    <h4 className="font-semibold text-sm mb-3">Документы для печати</h4>
                    <PrintDocumentsMenu order={selectedOrder} />
                  </div>
                )}

                {selectedOrder.operator_comment && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Комментарий оператора</p>
                    <p className="text-sm">{selectedOrder.operator_comment}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}