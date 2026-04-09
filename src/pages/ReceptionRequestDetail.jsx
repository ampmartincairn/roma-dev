import { useState, useEffect } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { db } from "@/api/base44Client";
import StatusBadge from "@/components/wms/StatusBadge";
import { toast } from "sonner";

const normalizeStatus = (status) => status?.trim().toLowerCase();
const isCreatedStatus = (status) => ["создана", "отправлена", "новая"].includes(normalizeStatus(status));
const isInProgressStatus = (status) => ["взята в работу", "в работе", "в обработке"].includes(normalizeStatus(status));
const isAcceptedStatus = (status) => ["принята", "завершена"].includes(normalizeStatus(status));
const isCanceledStatus = (status) => normalizeStatus(status) === "отменена";

export default function ReceptionRequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, role } = useOutletContext();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [operatorComment, setOperatorComment] = useState("");
  const [receivedQtys, setReceivedQtys] = useState({});

  useEffect(() => {
    loadRequest();
  }, [id]);

  const loadRequest = async () => {
    try {
      setLoading(true);
      const requestData = await db.entities.ReceptionRequest.get(id);
      setRequest(requestData);
      setOperatorComment(requestData?.operator_comment || "");
    } catch (error) {
      console.error("Error loading request:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!request) return;

    setActionLoading(true);
    try {
      const updateData = {
        status: newStatus,
        operator_comment: operatorComment || request.operator_comment,
        processed_by: user?.email,
        processed_date: new Date().toISOString(),
      };

      if (isInProgressStatus(newStatus) && !request.sent_to_work_date) {
        updateData.sent_to_work_date = new Date().toISOString();
      }

      if (normalizeStatus(newStatus) === "принята" && request.items?.length) {
        const targetWarehouse = request.warehouse || "Основной склад";
        const products = await db.entities.Product.filter({ client_email: request.client_email }, "name", 1000);
        const weightBySku = products.reduce((acc, p) => {
          acc[p.sku] = Number(p.weight_kg || 0);
          return acc;
        }, {});

        updateData.items = request.items.map((item, idx) => ({
          ...item,
          received_qty: receivedQtys[idx] !== undefined ? receivedQtys[idx] : (item.expected_qty ?? item.quantity ?? 0),
          weight_kg: item.weight_kg ?? item.weight ?? weightBySku[item.sku] ?? 0,
        }));

        for (const item of updateData.items) {
          const existing = await db.entities.Inventory.filter({
            sku: item.sku,
            client_email: request.client_email,
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
              client_email: request.client_email,
              warehouse: targetWarehouse,
              quantity: item.received_qty || 0,
              reserved: 0,
            });
          }
        }
      }

      await db.entities.ReceptionRequest.update(request.id, updateData);
      await db.entities.ActionLog.create({
        user_email: user?.email,
        user_name: user?.full_name,
        action: `Статус заявки изменён на "${newStatus}"`,
        entity_type: "ReceptionRequest",
        entity_id: request.id,
        details: `Заявка ${request.request_number || request.id}`,
      });

      setRequest((prev) => ({ ...prev, ...updateData }));
      toast.success(`Статус: "${newStatus}"`);
    } catch (error) {
      console.error("Error updating request status:", error);
      toast.error("Не удалось обновить статус заявки");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка заявки...</p>
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Заявка не найдена</p>
        <Button onClick={() => navigate("/incoming-flow")} className="mt-4">
          Вернуться к списку
        </Button>
      </div>
    );
  }

  const createdDate = request.created_date ? new Date(request.created_date).toLocaleString("ru-RU") : "-";
  const startedDate = request.sent_to_work_date ? new Date(request.sent_to_work_date).toLocaleString("ru-RU") : "-";
  const totalAcceptedWeight = (request.items || []).reduce((sum, item) => {
    const qty = Number(item.received_qty ?? item.expected_qty ?? item.quantity ?? 0);
    const unitWeight = Number(item.weight_kg ?? item.weight ?? 0);
    return sum + qty * unitWeight;
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate("/incoming-flow")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Назад
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Заявка #{request.request_number || request.id}</h1>
          <p className="text-muted-foreground">Подробная информация по заявке</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Общая информация</CardTitle>
            <CardDescription>Основные данные заявки</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-muted-foreground text-xs">Номер заявки</p>
                <p className="font-medium">{request.request_number || "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Статус</p>
                <StatusBadge status={request.status} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-muted-foreground text-xs">Дата создания</p>
                <p className="font-medium">{createdDate}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Начало обработки</p>
                <p className="font-medium">{startedDate}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-muted-foreground text-xs">Клиент</p>
                <p className="font-medium">{request.client_name || request.client_email || "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Маркетплейс</p>
                <p className="font-medium">{request.marketplace || "-"}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-muted-foreground text-xs">Склад</p>
                <p className="font-medium">{request.warehouse || "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Создал</p>
                <p className="font-medium">{request.client_name || request.client_email || "-"}</p>
              </div>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Общий вес принятой заявки</p>
              <p className="font-medium">{totalAcceptedWeight > 0 ? `${totalAcceptedWeight.toFixed(2)} кг` : "-"}</p>
            </div>
            {request.comment && (
              <div>
                <p className="text-muted-foreground text-xs">Комментарий</p>
                <p className="font-medium">{request.comment}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Товары в заявке</CardTitle>
            <CardDescription>Список товаров с артикулом, количеством, штрихкодом и весом</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2">Наименование</th>
                  <th className="px-3 py-2">Артикул</th>
                  <th className="px-3 py-2">Кол-во</th>
                  <th className="px-3 py-2">Штрихкод</th>
                  <th className="px-3 py-2">Вес</th>
                  {(role === "operator" || role === "admin") && isInProgressStatus(request.status) && (
                    <th className="px-3 py-2">Принято</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {request.items?.length > 0 ? (
                  request.items.map((item, index) => (
                    <tr key={index} className="border-t border-muted/20">
                      <td className="px-3 py-3 font-medium">{item.product_name || "-"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{item.sku || "-"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{item.received_qty ?? item.expected_qty ?? item.quantity ?? "-"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{item.barcode || "-"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{item.weight_kg ?? item.weight ?? "-"}</td>
                      {(role === "operator" || role === "admin") && isInProgressStatus(request.status) && (
                        <td className="px-3 py-3">
                          <Input
                            type="number"
                            min={0}
                            className="h-8 w-24"
                            value={receivedQtys[index] !== undefined ? receivedQtys[index] : (item.expected_qty ?? item.quantity ?? 0)}
                            onChange={(e) => setReceivedQtys((prev) => ({ ...prev, [index]: parseInt(e.target.value, 10) || 0 }))}
                          />
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                      Товары не найдены
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {(role === "operator" || role === "admin") && !isAcceptedStatus(request.status) && !isCanceledStatus(request.status) && (
        <Card>
          <CardHeader>
            <CardTitle>Обработка заявки</CardTitle>
            <CardDescription>Изменение статуса и комментарий оператора</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isInProgressStatus(request.status) && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm font-semibold text-blue-800">Приёмка по факту</p>
                <p className="text-xs text-blue-700 mt-1">
                  Укажите фактическое количество по каждой позиции. После подтверждения на склад поступит именно это количество.
                </p>
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              {isCreatedStatus(request.status) && (
                <Button onClick={() => handleStatusChange("взята в работу")} disabled={actionLoading}>
                  Взять в работу
                </Button>
              )}

              {isInProgressStatus(request.status) && (
                <>
                  <Button onClick={() => handleStatusChange("принята")} disabled={actionLoading}>
                    Принять по факту
                  </Button>
                  <Button variant="outline" onClick={() => handleStatusChange("отменена")} disabled={actionLoading}>
                    Отменить
                  </Button>
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label>Комментарий оператора</Label>
              <Textarea
                rows={3}
                placeholder="Примечания по обработке заявки"
                value={operatorComment}
                onChange={(e) => setOperatorComment(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}