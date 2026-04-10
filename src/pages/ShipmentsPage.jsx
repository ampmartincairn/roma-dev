import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { db } from "@/api/base44Client";
import { Search, Truck, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PageHeader from "../components/wms/PageHeader";
import StatusBadge from "../components/wms/StatusBadge";
import StatusStepper from "../components/wms/StatusStepper";
import MarketplaceBadge from "../components/wms/MarketplaceBadge";
import EmptyState from "../components/wms/EmptyState";
import { PrintProductLabels, PrintBoxLabel, PrintPackingList } from "../components/wms/PrintDocuments";
import moment from "moment";
import { toast } from "sonner";

const PACKAGING_OPTIONS = [
  { value: "без упаковки", label: "Без упаковки" },
  { value: "zip-пакет", label: "Zip-пакет" },
  { value: "коробка S", label: "Коробка S" },
  { value: "коробка M", label: "Коробка M" },
  { value: "коробка L", label: "Коробка L" },
];

// Список можно будет легко заменить, когда вы пришлете актуальные склады по маркетплейсам.
const MARKETPLACE_WAREHOUSES = {
  Ozon: [
    "Хоругвино (РФЦ)",
    "Ногинск",
    "Раменское",
    "Подольск",
    "Павловская Слобода",
    "Москва (СЦ)",
  ],
  WB: [
    "Коледино",
    "Подольск",
    "Электросталь",
    "Пушкино",
    "Крёкшино",
    "Домодедово",
    "Чехов",
    "Вёшки",
  ],
};

const normalizeOutgoingStatus = (status) => {
  const normalized = status?.trim().toLowerCase();
  const mapping = {
    "в обработке": "взята в работу",
    "в комплектовке": "собрано",
    "упакована": "готова к отгрузке",
    "отгружена": "отгружено",
  };
  return mapping[normalized] || normalized || "новая";
};

const isFinishedStatus = (status) => ["отгружено", "отменена"].includes(normalizeOutgoingStatus(status));
const isAllowedOutgoingStatus = (status) => [
  "новая",
  "взята в работу",
  "упаковано",
  "собрано",
  "готова к отгрузке",
  "отгружено",
  "отменена",
].includes(normalizeOutgoingStatus(status));

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
      
      await db.entities.Inventory.update(row.id, {
        quantity: currentQty - deducted,
        reserved: Math.max(0, currentReserved - releaseReserved),
      });
      remaining -= deducted;
    }
  }
};

export default function ShipmentsPage() {
  const { user, role } = useOutletContext();
  const isClient = role === "client";
  const isClientActive = !isClient || user?.is_active === true;
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [operatorComment, setOperatorComment] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [allClientOrders, setAllClientOrders] = useState([]);
  const [clientProducts, setClientProducts] = useState([]);
  const [clientInventory, setClientInventory] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    order_number: "",
    client_name: "",
    marketplace: "",
    route_type: "marketplace",
    destination_warehouse: "",
    custom_warehouse_address: "",
    packaging_type: "",
    cargo_places: 1,
    comment: "",
    items: [{ productId: "", quantity: 1 }],
  });

  useEffect(() => {
    const load = async () => {
      const all = role === "client"
        ? await db.entities.AssemblyOrder.filter({ client_email: user?.email }, "-created_date", 100)
        : await db.entities.AssemblyOrder.list("-created_date", 100);

      const normalizedAll = all.map((order) => ({
        ...order,
        status: normalizeOutgoingStatus(order.status),
      }));

      const allowedStatuses = role === "client"
        ? ["новая", "взята в работу", "упаковано", "собрано", "готова к отгрузке", "отгружено"]
        : ["новая", "взята в работу", "упаковано", "собрано", "готова к отгрузке", "отгружено", "отменена"];

      setOrders(normalizedAll.filter(o => allowedStatuses.includes(o.status)));

      if (role === "client") {
        setAllClientOrders(normalizedAll);
        const products = await db.entities.Product.filter({ client_email: user?.email }, "name", 500);
        setClientProducts(products);
        const inventory = await db.entities.Inventory.filter({ client_email: user?.email }, "-updated_date", 1000);
        setClientInventory(inventory);
      }

      setLoading(false);
    };
    if (user) load();
  }, [user, role]);

  const nextClientOrderNumber = () => {
    const numericNumbers = allClientOrders
      .map((o) => Number(o.order_number))
      .filter((n) => Number.isFinite(n) && n > 0);

    if (numericNumbers.length > 0) {
      return String(Math.max(...numericNumbers) + 1);
    }

    return String(allClientOrders.length + 1);
  };

  const openCreateDialog = () => {
    if (isClient && !isClientActive) {
      toast.error("Аккаунт не активирован. Создание заявок недоступно.");
      return;
    }

    setForm({
      order_number: nextClientOrderNumber(),
      client_name: user?.company_name || user?.full_name || user?.email || "",
      marketplace: "",
      route_type: "marketplace",
      destination_warehouse: "",
      custom_warehouse_address: "",
      packaging_type: "",
      cargo_places: 1,
      comment: "",
      items: [{ productId: "", quantity: 1 }],
    });
    setShowCreate(true);
  };

  const availableBySku = clientInventory.reduce((acc, row) => {
    const sku = row.sku;
    if (!sku) return acc;
    const qty = Number(row.quantity || 0);
    const reserved = Number(row.reserved || 0);
    const free = Math.max(0, qty - reserved);
    acc[sku] = (acc[sku] || 0) + free;
    return acc;
  }, {});

  const getProductById = (productId) => clientProducts.find((p) => String(p.id) === String(productId));

  const getAvailableByProductId = (productId) => {
    const product = getProductById(productId);
    if (!product) return 0;
    return Number(availableBySku[product.sku] || 0);
  };

  const updateItem = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, idx) => (idx === index ? { ...item, [field]: value } : item)),
    }));
  };

  const addItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { productId: "", quantity: 1 }],
    }));
  };

  const removeItem = (index) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index),
    }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();

    if (isClient && !isClientActive) {
      toast.error("Аккаунт не активирован. Создание заявок недоступно.");
      return;
    }

    if (form.route_type === "marketplace" && (!form.marketplace || !form.destination_warehouse)) {
      toast.error("Выберите маркетплейс и склад");
      return;
    }

    if (form.route_type === "custom" && !form.custom_warehouse_address.trim()) {
      toast.error("Укажите адрес другого склада");
      return;
    }

    if (!form.cargo_places || Number(form.cargo_places) < 1) {
      toast.error("Укажите количество грузомест");
      return;
    }

    const hasInvalidItems = form.items.some((item) => !item.productId || !item.quantity || item.quantity < 1);
    if (hasInvalidItems) {
      toast.error("Заполните товары и количество");
      return;
    }

    // Проверяем, что суммарное количество по каждому SKU не превышает доступный остаток.
    const requestedBySku = {};
    for (const item of form.items) {
      const product = getProductById(item.productId);
      if (!product) {
        toast.error("Выбранный товар не найден");
        return;
      }
      requestedBySku[product.sku] = (requestedBySku[product.sku] || 0) + Number(item.quantity || 0);
    }

    for (const [sku, requested] of Object.entries(requestedBySku)) {
      const available = Number(availableBySku[sku] || 0);
      if (requested > available) {
        toast.error(`Недостаточно остатка для SKU ${sku}: доступно ${available}, запрошено ${requested}`);
        return;
      }
    }

    setCreating(true);
    try {
      const items = form.items
        .map((item) => {
          const product = getProductById(item.productId);
          if (!product) return null;
          return {
            product_name: product.name,
            sku: product.sku,
            barcode: product.barcode || product.ean || product.code128 || "",
            quantity: Number(item.quantity),
            honest_mark: "",
          };
        })
        .filter(Boolean);

      await db.entities.AssemblyOrder.create({
        order_number: form.order_number,
        client_email: user?.email,
        client_name: form.client_name,
        status: "новая",
        marketplace: form.route_type === "marketplace" ? form.marketplace : "Другой склад",
        destination_warehouse: form.route_type === "marketplace" ? form.destination_warehouse : form.custom_warehouse_address.trim(),
        packaging_type: form.packaging_type,
        cargo_places: Number(form.cargo_places),
        comment: form.comment,
        items,
      });

      // Резервируем товары для новой заявки
      const newOrder = (await db.entities.AssemblyOrder.filter(
        { client_email: user?.email, order_number: form.order_number },
        "-created_date",
        1
      ))[0];
      
      if (newOrder) {
        await reserveInventoryForOrder(newOrder);
      }

      await db.entities.ActionLog.create({
        user_email: user?.email,
        user_name: user?.full_name,
        action: "Создана заявка на отгрузку",
        entity_type: "AssemblyOrder",
        details: `Заявка ${form.order_number}`,
      });

      toast.success("Заявка на отгрузку создана");
      setShowCreate(false);

      const all = await db.entities.AssemblyOrder.filter({ client_email: user?.email }, "-created_date", 100);
      const normalizedAll = all.map((order) => ({
        ...order,
        status: normalizeOutgoingStatus(order.status),
      }));
      setAllClientOrders(normalizedAll);
      setOrders(normalizedAll.filter(o => ["новая", "взята в работу", "упаковано", "собрано", "готова к отгрузке", "отгружено"].includes(o.status)));

      const inventory = await db.entities.Inventory.filter({ client_email: user?.email }, "-updated_date", 1000);
      setClientInventory(inventory);
    } catch (error) {
      console.error("Error creating shipment request:", error);
      toast.error("Не удалось создать заявку");
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (order, newStatus) => {
    setActionLoading(true);
    try {
      const freshOrder = await db.entities.AssemblyOrder.get(order.id);
      const wasAlreadyShipped = normalizeOutgoingStatus(freshOrder?.status) === "отгружено";

      // Если отмена заявки (и она ещё не отгружена) - освобождаем резервирование
      if (newStatus === "отменена" && !wasAlreadyShipped) {
        await releaseReservationForOrder(freshOrder || order);
      }

      // Если отгрузка (и она ещё не отгружена) - списываем товары со склада
      if (newStatus === "отгружено" && !wasAlreadyShipped) {
        await deductShippedItemsFromInventory(freshOrder || order);
      }

      const updateData = {
        status: newStatus,
        operator_comment: operatorComment || order.operator_comment,
        processed_by: user?.email,
      };

      if (newStatus === "отгружено") {
        updateData.shipped_date = new Date().toISOString();
      }

      await db.entities.AssemblyOrder.update(order.id, updateData);
      await db.entities.ActionLog.create({
        user_email: user?.email,
        user_name: user?.full_name,
        action: `Статус заявки изменён на "${newStatus}"`,
        entity_type: "AssemblyOrder",
        entity_id: order.id,
        details: `Заявка ${order.order_number}`,
      });

      toast.success(`Статус: "${newStatus}"`);
      setSelectedOrder((prev) => prev ? ({ ...prev, ...updateData }) : prev);

      const all = role === "client"
        ? await db.entities.AssemblyOrder.filter({ client_email: user?.email }, "-created_date", 100)
        : await db.entities.AssemblyOrder.list("-created_date", 100);
      const normalizedAll = all.map((item) => ({ ...item, status: normalizeOutgoingStatus(item.status) }));
      const allowedStatuses = role === "client"
        ? ["новая", "взята в работу", "упаковано", "собрано", "готова к отгрузке", "отгружено"]
        : ["новая", "взята в работу", "упаковано", "собрано", "готова к отгрузке", "отгружено", "отменена"];
      setOrders(normalizedAll.filter((item) => allowedStatuses.includes(item.status)));

      // Обновляем инвентарь в UI
      const inventory = await db.entities.Inventory.filter({ client_email: user?.email }, "-updated_date", 1000);
      setClientInventory(inventory);
    } catch (error) {
      console.error("Error updating shipment status:", error);
      toast.error("Не удалось обновить статус");
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = orders.filter((o) => {
    return !search ||
      o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
      o.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.destination_warehouse?.toLowerCase().includes(search.toLowerCase());
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
        title="Отгрузки"
        description="Заявки на отгрузку и их текущий статус"
        actions={
          role === "client" ? (
            <Button onClick={openCreateDialog} disabled={!isClientActive}>
              <Plus className="h-4 w-4 mr-2" />
              Новая отгрузка
            </Button>
          ) : null
        }
      />

      {isClient && !isClientActive && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Создание заявок на отгрузку недоступно, пока администратор не активирует ваш аккаунт.
        </div>
      )}

      <div className="relative max-w-md mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Поиск..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Truck} title="Нет отгрузок" description="Нет заказов, готовых к отгрузке" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((o) => (
            <div key={o.id} className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-all hover:border-primary/20">
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-sm">{o.order_number}</span>
                <StatusBadge status={o.status} />
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Клиент</span>
                  <span className="font-medium">{o.client_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Маркетплейс</span>
                  <MarketplaceBadge marketplace={o.marketplace} />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Склад</span>
                  <span className="font-medium">{o.destination_warehouse}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Упаковка</span>
                  <span>{o.packaging_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Грузомест</span>
                  <span>{o.cargo_places || "—"}</span>
                </div>
                {o.shipped_date && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Дата отгрузки</span>
                    <span>{moment(o.shipped_date).format("DD.MM.YYYY HH:mm")}</span>
                  </div>
                )}
                <div className="pt-2 border-t">
                  <span className="text-xs text-muted-foreground">Товаров: {o.items?.length || 0} позиций</span>
                </div>
                {(role === "operator" || role === "admin") && (
                  <div className="pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedOrder(o);
                        setOperatorComment(o.operator_comment || "");
                      }}
                    >
                      Открыть
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

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
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Клиент</p>
                    <p className="font-medium">{selectedOrder.client_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Текущий статус</p>
                    <p className="font-medium">{selectedOrder.status}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Упаковка</p>
                    <p className="font-medium">{selectedOrder.packaging_type || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Склад</p>
                    <p className="font-medium">{selectedOrder.destination_warehouse || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Грузомест</p>
                    <p className="font-medium">{selectedOrder.cargo_places || "—"}</p>
                  </div>
                </div>

                {selectedOrder.items?.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Товары заявки</h4>
                    <div className="space-y-2">
                      {selectedOrder.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg text-sm">
                          <div>
                            <p className="font-medium">{item.product_name}</p>
                            <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                          </div>
                          <span className="font-semibold">{item.quantity} шт.</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3 pt-3 border-t">
                  <h4 className="font-semibold text-sm">Печать документов (Code128)</h4>
                  <div className="flex flex-wrap gap-2">
                    <PrintProductLabels items={selectedOrder.items || []} orderId={selectedOrder.order_number} />
                    <PrintBoxLabel order={selectedOrder} />
                    <PrintPackingList order={selectedOrder} />
                  </div>
                </div>

                {(role === "operator" || role === "admin") && !isFinishedStatus(selectedOrder.status) && isAllowedOutgoingStatus(selectedOrder.status) && (
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

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Новая отгрузка</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Номер заявки</Label>
                <Input value={form.order_number} readOnly />
              </div>
              <div className="space-y-2">
                <Label>Компания</Label>
                <Input value={form.client_name} readOnly />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Направление *</Label>
                <Select
                  value={form.route_type}
                  onValueChange={(value) => {
                    setForm((prev) => ({
                      ...prev,
                      route_type: value,
                      marketplace: "",
                      destination_warehouse: "",
                      custom_warehouse_address: "",
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите направление" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="marketplace">Маркетплейс</SelectItem>
                    <SelectItem value="custom">Другой склад</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.route_type === "marketplace" ? (
                <div className="space-y-2">
                  <Label>Маркетплейс *</Label>
                  <Select
                    value={form.marketplace}
                    onValueChange={(value) => {
                      setForm((prev) => ({
                        ...prev,
                        marketplace: value,
                        destination_warehouse: "",
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите маркетплейс" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WB">Wildberries</SelectItem>
                      <SelectItem value="Ozon">Ozon</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Адрес другого склада *</Label>
                  <Input
                    value={form.custom_warehouse_address}
                    onChange={(e) => setForm((prev) => ({ ...prev, custom_warehouse_address: e.target.value }))}
                    placeholder="Введите адрес склада"
                    required={form.route_type === "custom"}
                  />
                </div>
              )}
            </div>

            {form.route_type === "marketplace" && (
              <div className="space-y-2">
                <Label>Склад маркетплейса *</Label>
                <Select
                  value={form.destination_warehouse}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, destination_warehouse: value }))}
                  disabled={!form.marketplace}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={form.marketplace ? "Выберите склад" : "Сначала выберите маркетплейс"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(MARKETPLACE_WAREHOUSES[form.marketplace] || []).map((warehouse) => (
                      <SelectItem key={warehouse} value={warehouse}>{warehouse}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Упаковка *</Label>
              <Select value={form.packaging_type} onValueChange={(value) => setForm((prev) => ({ ...prev, packaging_type: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите тип упаковки" />
                </SelectTrigger>
                <SelectContent>
                  {PACKAGING_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Количество грузомест *</Label>
              <Input
                type="number"
                min={1}
                value={form.cargo_places}
                onChange={(e) => setForm((prev) => ({ ...prev, cargo_places: parseInt(e.target.value, 10) || 1 }))}
                placeholder="Введите количество грузомест"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Товары клиента *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1" /> Добавить товар
                </Button>
              </div>

              {form.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-start p-3 bg-muted/40 rounded-lg">
                  <div className="col-span-12 sm:col-span-8 space-y-1">
                    <Label className="text-xs">Товар</Label>
                    <Select
                      value={item.productId}
                      onValueChange={(value) => updateItem(idx, "productId", value)}
                      disabled={clientProducts.length === 0}
                    >
                      <SelectTrigger className="h-9 w-full min-w-0">
                        <SelectValue placeholder={clientProducts.length === 0 ? "Нет доступных товаров" : "Выберите товар"} />
                      </SelectTrigger>
                      <SelectContent>
                        {clientProducts.map((product) => (
                          <SelectItem key={product.id} value={String(product.id)}>
                            <span className="block max-w-[260px] truncate" title={`${product.name} (${product.sku})`}>
                              {product.name} ({product.sku})
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-10 sm:col-span-3 space-y-1">
                    <Label className="text-xs">Количество</Label>
                    <Input
                      type="number"
                      min={1}
                      max={item.productId ? getAvailableByProductId(item.productId) : undefined}
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value, 10) || 1)}
                    />
                    {item.productId && (
                      <p className="text-xs text-muted-foreground">
                        Доступно: {getAvailableByProductId(item.productId)}
                      </p>
                    )}
                  </div>

                  <div className="col-span-2 sm:col-span-1 flex justify-end pb-0.5">
                    {form.items.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(idx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Комментарий</Label>
              <Textarea
                value={form.comment}
                onChange={(e) => setForm((prev) => ({ ...prev, comment: e.target.value }))}
                placeholder="Дополнительная информация по отгрузке"
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Отмена</Button>
              <Button
                type="submit"
                disabled={
                  creating ||
                  !form.packaging_type ||
                  clientProducts.length === 0 ||
                  (form.route_type === "marketplace" && (!form.marketplace || !form.destination_warehouse)) ||
                  (form.route_type === "custom" && !form.custom_warehouse_address.trim())
                }
              >
                {creating ? "Создание..." : "Создать заявку"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}