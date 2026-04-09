import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { db } from "@/api/base44Client";
import { Plus, Search, Filter, ClipboardList } from "lucide-react";
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
import ReceptionForm from "../components/wms/ReceptionForm";
import StatusStepper from "../components/wms/StatusStepper";
import { toast } from "sonner";

const normalizeStatus = (status) => {
  const normalized = status?.trim().toLowerCase();
  const mapping = {
    "создана": "новая",
    "отправлена": "новая",
    "новая": "новая",
    "в обработке": "взята в работу",
    "в работе": "взята в работу",
    "взята в работу": "взята в работу",
    "принята": "принята",
    "завершена": "принята",
    "отменена": "отменена",
  };
  return mapping[normalized] || normalized || "новая";
};

const isCreatedStatus = (status) => normalizeStatus(status) === "новая";
const isInProgressStatus = (status) => normalizeStatus(status) === "взята в работу";
const isAcceptedStatus = (status) => normalizeStatus(status) === "принята";
const isCanceledStatus = (status) => normalizeStatus(status) === "отменена";

export default function ReceptionRequests() {
  const { user, role } = useOutletContext();
  const isClient = role === "client";
  const isClientActive = !isClient || user?.is_active === true;
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active"); // "active" = скрыть принятые/отменённые
  const [selectedReq, setSelectedReq] = useState(null);
  const [operatorComment, setOperatorComment] = useState("");
  const [receivedQtys, setReceivedQtys] = useState({});

  const loadData = async () => {
    const isClient = role === "client";
    const data = isClient
      ? await db.entities.ReceptionRequest.filter({ client_email: user?.email }, "-created_date", 100)
      : await db.entities.ReceptionRequest.list("-created_date", 100);
    setRequests(data);
    setLoading(false);
  };

  useEffect(() => {
    if (user) loadData();
  }, [user, role]);

  const handleCreate = async (form) => {
    if (isClient && !isClientActive) {
      toast.error("Аккаунт не активирован. Создание заявок недоступно.");
      return;
    }

    setCreating(true);
    const num = "ПР-" + Date.now().toString(36).toUpperCase();
    await db.entities.ReceptionRequest.create({
      request_number: num,
      client_email: user.email,
      client_name: user.full_name,
      status: "новая",
      marketplace: form.marketplace,
      warehouse: form.warehouse,
      comment: form.comment,
      items: form.items,
    });
    await db.entities.ActionLog.create({
      user_email: user.email,
      user_name: user.full_name,
      action: "Создана заявка на приёмку",
      entity_type: "ReceptionRequest",
      details: `Номер: ${num}`,
    });
    toast.success("Заявка создана");
    setShowCreate(false);
    setCreating(false);
    loadData();
  };

  const handleStatusChange = async (req, newStatus) => {
    setActionLoading(true);

    const updateData = {
      status: newStatus,
      operator_comment: operatorComment || req.operator_comment,
      processed_by: user.email,
      processed_date: new Date().toISOString(),
    };

    if (isInProgressStatus(newStatus) && !req.sent_to_work_date) {
      updateData.sent_to_work_date = new Date().toISOString();
    }

    if (isAcceptedStatus(newStatus) && req.items?.length) {
      const targetWarehouse = req.warehouse || "Основной склад";
      const products = await db.entities.Product.filter({ client_email: req.client_email }, "name", 1000);
      const weightBySku = products.reduce((acc, p) => {
        acc[p.sku] = Number(p.weight_kg || 0);
        return acc;
      }, {});

      updateData.items = req.items.map((item, idx) => ({
        ...item,
        received_qty: receivedQtys[idx] !== undefined ? receivedQtys[idx] : (item.expected_qty ?? item.quantity ?? 0),
        weight_kg: item.weight_kg ?? item.weight ?? weightBySku[item.sku] ?? 0,
      }));

      for (const item of updateData.items) {
        const existing = await db.entities.Inventory.filter({
          sku: item.sku,
          client_email: req.client_email,
          warehouse: targetWarehouse,
        });
        if (existing.length > 0) {
          await db.entities.Inventory.update(existing[0].id, {
            quantity: (existing[0].quantity || 0) + (item.received_qty || 0),
          });
        } else {
          await db.entities.Inventory.create({
            product_name: item.product_name,
            sku: item.sku,
            client_email: req.client_email,
            warehouse: targetWarehouse,
            quantity: item.received_qty || 0,
            reserved: 0,
          });
        }
      }
    }

    await db.entities.ReceptionRequest.update(req.id, updateData);
    await db.entities.ActionLog.create({
      user_email: user.email,
      user_name: user.full_name,
      action: `Статус заявки изменён на "${newStatus}"`,
      entity_type: "ReceptionRequest",
      entity_id: req.id,
      details: `Заявка ${req.request_number}`,
    });

    toast.success(`Статус: "${newStatus}"`);
    setActionLoading(false);
    setSelectedReq(prev => ({ ...prev, ...updateData }));
    loadData();
  };

  const canDeleteRequest = (req) => {
    if (role === "admin") return true;
    if (role === "client" && req.status === "новая") return true;
    return false;
  };

  const handleDelete = async (req) => {
    if (!canDeleteRequest(req)) return;
    if (!confirm(`Удалить заявку ${req.request_number}?`)) return;

    setActionLoading(true);
    await db.entities.ReceptionRequest.delete(req.id);
    await db.entities.ActionLog.create({
      user_email: user.email,
      user_name: user.full_name,
      action: "Заявка удалена",
      entity_type: "ReceptionRequest",
      entity_id: req.id,
      details: `Заявка ${req.request_number}`,
    });
    toast.success("Заявка удалена");
    setActionLoading(false);
    if (selectedReq?.id === req.id) {
      setSelectedReq(null);
      setOperatorComment("");
      setReceivedQtys({});
    }
    loadData();
  };

  const filtered = requests.filter((r) => {
    const matchSearch = !search ||
      r.request_number?.toLowerCase().includes(search.toLowerCase()) ||
      r.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.client_email?.toLowerCase().includes(search.toLowerCase());

    let matchStatus = true;
    if (statusFilter === "active") {
      matchStatus = !isAcceptedStatus(r.status) && !isCanceledStatus(r.status);
    } else if (statusFilter !== "all") {
      matchStatus = normalizeStatus(r.status) === normalizeStatus(statusFilter);
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
        title="Заявки на приёмку"
        description="Управление заявками на приёмку товара на склад"
        actions={
          role !== "operator" && (
            <Button onClick={() => setShowCreate(true)} disabled={isClient && !isClientActive}>
              <Plus className="h-4 w-4 mr-2" /> Новая заявка
            </Button>
          )
        }
      />

      {isClient && !isClientActive && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Создание заявок недоступно, пока администратор не активирует ваш аккаунт.
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Поиск по номеру или клиенту..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-52">
            <Filter className="h-4 w-4 mr-2" /><SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Активные (в работе)</SelectItem>
            <SelectItem value="all">Все заявки</SelectItem>
            <SelectItem value="новая">Новые</SelectItem>
            <SelectItem value="взята в работу">Взята в работу</SelectItem>
            <SelectItem value="принята">Принятые</SelectItem>
            <SelectItem value="отменена">Отменённые</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={statusFilter === "active" ? "Нет активных заявок" : "Нет заявок"}
          description={statusFilter === "active" ? "Все заявки обработаны — переключите фильтр для просмотра истории" : "Создайте первую заявку на приёмку товара"}
        />
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Номер</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Клиент</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Маркетплейс</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden sm:table-cell">Склад</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Статус</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-medium">{r.request_number}</td>
                    <td className="py-3 px-4 hidden md:table-cell text-muted-foreground">{r.client_name || r.client_email}</td>
                    <td className="py-3 px-4"><MarketplaceBadge marketplace={r.marketplace} /></td>
                    <td className="py-3 px-4 hidden sm:table-cell text-muted-foreground">{r.warehouse}</td>
                    <td className="py-3 px-4"><StatusBadge status={r.status} /></td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-2">
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedReq(r); setOperatorComment(r.operator_comment || ""); setReceivedQtys({}); }}>
                          Открыть
                        </Button>
                        {canDeleteRequest(r) && (
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(r)}>
                            Удалить
                          </Button>
                        )}
                      </div>
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
          <DialogHeader><DialogTitle>Новая заявка на приёмку</DialogTitle></DialogHeader>
          <ReceptionForm onSubmit={handleCreate} onCancel={() => setShowCreate(false)} loading={creating} />
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!selectedReq} onOpenChange={() => { setSelectedReq(null); setOperatorComment(""); setReceivedQtys({}); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedReq && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  {selectedReq.request_number}
                  <StatusBadge status={selectedReq.status} />
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5">
                {/* Meta */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><p className="text-muted-foreground text-xs">Клиент</p><p className="font-medium">{selectedReq.client_name || selectedReq.client_email}</p></div>
                  <div><p className="text-muted-foreground text-xs">Маркетплейс</p><MarketplaceBadge marketplace={selectedReq.marketplace} /></div>
                  <div><p className="text-muted-foreground text-xs">Склад</p><p className="font-medium">{selectedReq.warehouse}</p></div>
                  {selectedReq.comment && (
                    <div className="col-span-2"><p className="text-muted-foreground text-xs">Комментарий клиента</p><p>{selectedReq.comment}</p></div>
                  )}
                </div>

                {/* Items */}
                {selectedReq.items?.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Товары</h4>
                    <div className="space-y-2">
                      {selectedReq.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg text-sm">
                          <div>
                            <p className="font-medium">{item.product_name}</p>
                            <p className="text-xs text-muted-foreground">SKU: {item.sku}{item.barcode && ` | ШК: ${item.barcode}`}</p>
                          </div>
                          <div className="flex items-center gap-3 text-right">
                            <span className="text-muted-foreground text-xs">Ожид: {item.expected_qty}</span>
                            {(role === "operator" || role === "admin") && isInProgressStatus(selectedReq.status) && (
                              <Input
                                type="number" min={0} className="w-20 h-8"
                                value={receivedQtys[idx] !== undefined ? receivedQtys[idx] : item.expected_qty}
                                onChange={(e) => setReceivedQtys(prev => ({ ...prev, [idx]: parseInt(e.target.value) || 0 }))}
                              />
                            )}
                            {item.received_qty !== undefined && (
                              <span className="text-wms-success font-semibold text-xs">Принято: {item.received_qty}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Operator status control */}
                {(role === "operator" || role === "admin") && !isAcceptedStatus(selectedReq.status) && !isCanceledStatus(selectedReq.status) && (
                  <div className="space-y-3 pt-3 border-t">
                    <h4 className="font-semibold text-sm">Смена статуса</h4>
                    <StatusStepper
                      status={selectedReq.status}
                      type="reception"
                      onNext={(next) => handleStatusChange(selectedReq, next)}
                      onCancel={() => handleStatusChange(selectedReq, "отменена")}
                      loading={actionLoading}
                    />
                    <div className="space-y-1.5">
                      <Label className="text-xs">Комментарий оператора</Label>
                      <Textarea value={operatorComment} onChange={(e) => setOperatorComment(e.target.value)} placeholder="Примечания при приёмке..." rows={2} />
                    </div>
                  </div>
                )}

                {(role === "operator" || role === "admin") && isInProgressStatus(selectedReq.status) && (
                  <div className="space-y-3 pt-3 border-t">
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                      <p className="text-sm font-semibold text-blue-800">Приёмка по факту</p>
                      <p className="text-xs text-blue-700 mt-1">
                        Укажите фактическое количество по каждой позиции. В остатки будет зачислено именно это значение.
                      </p>
                    </div>
                  </div>
                )}

                {canDeleteRequest(selectedReq) && (
                  <div className="pt-3 border-t">
                    <Button variant="outline" className="text-destructive" onClick={() => handleDelete(selectedReq)} disabled={actionLoading}>
                      Удалить заявку
                    </Button>
                  </div>
                )}

                {selectedReq.operator_comment && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Комментарий оператора</p>
                    <p className="text-sm">{selectedReq.operator_comment}</p>
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