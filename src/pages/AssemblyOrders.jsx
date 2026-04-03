import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { base44 } from "@/api/base44Client";
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
      ? await base44.entities.AssemblyOrder.filter({ client_email: user?.email }, "-created_date", 100)
      : await base44.entities.AssemblyOrder.list("-created_date", 100);
    setOrders(data);
    setLoading(false);
  };

  useEffect(() => {
    if (user) loadData();
  }, [user, role]);

  const handleCreate = async (form) => {
    setCreating(true);
    const num = "СБ-" + Date.now().toString(36).toUpperCase();
    await base44.entities.AssemblyOrder.create({
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
    await base44.entities.ActionLog.create({
      user_email: user.email,
      user_name: user.full_name,
      action: "Создан заказ на сборку",
      entity_type: "AssemblyOrder",
      details: `Номер: ${num}`,
    });
    toast.success("Заказ на сборку создан");
    setShowCreate(false);
    setCreating(false);
    loadData();
  };

  const handleStatusChange = async (order, newStatus) => {
    setActionLoading(true);
    const updateData = {
      status: newStatus,
      operator_comment: operatorComment || order.operator_comment,
      processed_by: user.email,
    };
    if (newStatus === "отгружена") {
      updateData.shipped_date = new Date().toISOString();
    }
    await base44.entities.AssemblyOrder.update(order.id, updateData);
    await base44.entities.ActionLog.create({
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
  };

  const filtered = orders.filter((o) => {
    const matchSearch = !search ||
      o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
      o.client_name?.toLowerCase().includes(search.toLowerCase());

    let matchStatus = true;
    if (statusFilter === "active") {
      matchStatus = o.status !== "отгружена" && o.status !== "отменена";
    } else if (statusFilter !== "all") {
      matchStatus = o.status === statusFilter;
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
            <SelectItem value="all">Все заказы</SelectItem>
            <SelectItem value="новая">Новые</SelectItem>
            <SelectItem value="в обработке">В обработке</SelectItem>
            <SelectItem value="в комплектовке">В комплектовке</SelectItem>
            <SelectItem value="упакована">Упакованные</SelectItem>
            <SelectItem value="отгружена">Отгруженные</SelectItem>
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
                {(role === "operator" || role === "admin") && selectedOrder.status !== "отгружена" && selectedOrder.status !== "отменена" && (
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