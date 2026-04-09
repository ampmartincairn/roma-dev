import { useState, useEffect } from "react";
import { db } from "@/api/base44Client";
import { Plus, Search, Filter, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import StatusBadge from "./StatusBadge";
import EmptyState from "./EmptyState";
import ReceptionForm from "./ReceptionForm";
import { toast } from "sonner";

const formatDateTime = (dateString) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleDateString("ru-RU") + " " + date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
};

const normalizeStatus = (status) => status?.trim().toLowerCase();

const isCreatedStatus = (status) => ["создана", "отправлена", "новая"].includes(normalizeStatus(status));
const isInProgressStatus = (status) => ["взята в работу", "в работе", "в обработке"].includes(normalizeStatus(status));
const isAcceptedStatus = (status) => ["принята", "завершена"].includes(normalizeStatus(status));
const isCanceledStatus = (status) => normalizeStatus(status) === "отменена";

export default function ReceptionRequestList({ receptionType = "приемка", user: propUser, role: propRole }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [selectedReq, setSelectedReq] = useState(null);
  const [operatorComment, setOperatorComment] = useState("");
  const [receivedQtys, setReceivedQtys] = useState({});
  
  const user = propUser;
  const role = propRole === "user" ? "client" : propRole;

  const loadData = async () => {
    if (!user) return;
    
    const isClient = role === "client";
    let data = [];
    
    try {
      // Загружаем все заявки и потом фильтруем локально, чтобы учесть старые заявки
      if (isClient) {
        const allData = await db.entities.ReceptionRequest.filter(
          { client_email: user?.email }, 
          "-created_date", 
          100
        );
        // Фильтруем по типу приемки (новые заявки) или если поля нет (старые заявки)
        data = allData.filter(r => !r.reception_type || r.reception_type === receptionType);
      } else {
        const allData = await db.entities.ReceptionRequest.list("-created_date", 100);
        // Фильтруем по типу приемки (новые заявки) или если поля нет (старые заявки)
        data = allData.filter(r => !r.reception_type || r.reception_type === receptionType);
      }
      
      setRequests(data);
    } catch (error) {
      console.error("Ошибка загрузки данных:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadData();
  }, [user, role, receptionType]);

  const handleCreate = async (form) => {
    setCreating(true);
    const now = new Date().toISOString();
    
    await db.entities.ReceptionRequest.create({
      request_number: Math.ceil(Math.random() * 1000000),
      reception_type: receptionType,
      client_email: user.email,
      client_name: user.full_name,
      status: "новая",
      created_date: now,
      sent_to_work_date: null,
      marketplace: form.marketplace,
      warehouse: form.warehouse,
      comment: form.comment,
      items: form.items,
    });
    
    await db.entities.ActionLog.create({
      user_email: user.email,
      user_name: user.full_name,
      action: `Создана заявка на ${receptionType}`,
      entity_type: "ReceptionRequest",
      details: `Тип: ${receptionType}`,
    });
    
    toast.success("Заявка создана");
    setShowCreate(false);
    setCreating(false);
    loadData();
  };

  const handleStatusChange = async (req, newStatus) => {
    setActionLoading(true);

    try {
      const updateData = {
        status: newStatus,
        operator_comment: operatorComment || req.operator_comment,
        processed_by: user.email,
        processed_date: new Date().toISOString(),
      };

      if (isInProgressStatus(newStatus) && !req.sent_to_work_date) {
        updateData.sent_to_work_date = new Date().toISOString();
      }

      if (normalizeStatus(newStatus) === "принята" && req.items?.length) {
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
      await loadData();
      setSelectedReq(null);
    } catch (error) {
      console.error("Ошибка при обновлении статуса:", error);
      toast.error("Ошибка при обновлении статуса");
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = requests.filter((r) => {
    const matchSearch = !search ||
      r.request_number?.toString().includes(search) ||
      r.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.client_email?.toLowerCase().includes(search.toLowerCase());

    let matchStatus = true;
    if (statusFilter === "active") {
      // Активные заявки - все кроме завершенных и отмененных
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
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Поиск по номеру или клиенту..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="pl-9" 
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-52">
            <Filter className="h-4 w-4 mr-2" /><SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Активные</SelectItem>
            <SelectItem value="all">Все заявки</SelectItem>
            <SelectItem value="отправлена">Отправленные</SelectItem>
            <SelectItem value="в работе">В работе</SelectItem>
            <SelectItem value="завершена">Завершённые</SelectItem>
            <SelectItem value="новая">Новые</SelectItem>
            <SelectItem value="в обработке">В обработке</SelectItem>
            <SelectItem value="принята">Принятые</SelectItem>
            <SelectItem value="отменена">Отменённые</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={statusFilter === "active" ? "Нет активных заявок" : "Нет заявок"}
          description={statusFilter === "active" ? "Все заявки обработаны — переключите фильтр для просмотра истории" : `Создайте первую заявку на ${receptionType}`}
        />
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">ID документа</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Дата создания</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Наименование клиента</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Статус</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Дата отправки в работу</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Дей.</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-medium">{r.request_number}</td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">{formatDateTime(r.created_date)}</td>
                    <td className="py-3 px-4">{r.client_name || r.client_email}</td>
                    <td className="py-3 px-4"><StatusBadge status={r.status} /></td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">{formatDateTime(r.sent_to_work_date)}</td>
                    <td className="py-3 px-4">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => { 
                          setSelectedReq(r); 
                          setOperatorComment(r.operator_comment || ""); 
                          setReceivedQtys({}); 
                        }}
                      >
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

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Новая заявка на {receptionType}</DialogTitle>
          </DialogHeader>
          <ReceptionForm 
            onSubmit={handleCreate} 
            onCancel={() => setShowCreate(false)} 
            loading={creating} 
          />
        </DialogContent>
      </Dialog>

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
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Клиент</p>
                    <p className="font-medium">{selectedReq.client_name || selectedReq.client_email}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Тип</p>
                    <p className="font-medium">{selectedReq.reception_type}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Дата создания</p>
                    <p className="font-medium">{formatDateTime(selectedReq.created_date)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Статус</p>
                    <p className="font-medium">{selectedReq.status}</p>
                  </div>
                  {selectedReq.sent_to_work_date && (
                    <div>
                      <p className="text-muted-foreground text-xs">Отправлена в работу</p>
                      <p className="font-medium">{formatDateTime(selectedReq.sent_to_work_date)}</p>
                    </div>
                  )}
                  {selectedReq.comment && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground text-xs">Комментарий клиента</p>
                      <p>{selectedReq.comment}</p>
                    </div>
                  )}
                </div>

                {selectedReq.items?.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Товары</h4>
                    <div className="space-y-2">
                      {selectedReq.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg text-sm">
                          <div>
                            <p className="font-medium">{item.product_name}</p>
                            <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-muted-foreground text-xs">Ожид: {item.expected_qty}</span>
                            {(role === "operator" || role === "admin") && isInProgressStatus(selectedReq.status) && (
                              <Input
                                type="number" 
                                min={0} 
                                className="w-20 h-8"
                                value={receivedQtys[idx] !== undefined ? receivedQtys[idx] : item.expected_qty}
                                onChange={(e) => setReceivedQtys(prev => ({ ...prev, [idx]: parseInt(e.target.value) || 0 }))}
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(role === "operator" || role === "admin") && !isAcceptedStatus(selectedReq.status) && !isCanceledStatus(selectedReq.status) && (
                  <div className="space-y-3 pt-3 border-t">
                    <h4 className="font-semibold text-sm">Смена статуса</h4>
                    <div className="flex gap-2 flex-wrap">
                      {isCreatedStatus(selectedReq.status) && (
                        <Button 
                          onClick={() => handleStatusChange(selectedReq, "Взята в работу")}
                          disabled={actionLoading}
                        >
                          Взять в работу
                        </Button>
                      )}
                      {isInProgressStatus(selectedReq.status) && (
                        <>
                          <Button 
                            onClick={() => handleStatusChange(selectedReq, "Принята")}
                            disabled={actionLoading}
                            variant="default"
                          >
                            Принять
                          </Button>
                          <Button 
                            onClick={() => handleStatusChange(selectedReq, "Отменена")}
                            disabled={actionLoading}
                            variant="outline"
                          >
                            Отменить
                          </Button>
                        </>
                      )}
                      {(role === "admin") && (
                        <Button 
                          onClick={() => handleStatusChange(selectedReq, "Отменена")}
                          disabled={actionLoading}
                          variant="outline"
                          className="ml-auto"
                        >
                          Отменить
                        </Button>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Комментарий оператора</Label>
                      <Textarea 
                        value={operatorComment} 
                        onChange={(e) => setOperatorComment(e.target.value)} 
                        placeholder="Примечания..." 
                        rows={2} 
                      />
                    </div>
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
