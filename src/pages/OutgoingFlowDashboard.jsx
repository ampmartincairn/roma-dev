import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Truck, Clock, CheckCircle, Package } from "lucide-react";
import { db } from "@/api/base44Client";

const TIME_PERIODS = [
  { value: "week", label: "Неделя" },
  { value: "month", label: "Месяц" },
  { value: "quarter", label: "Квартал" },
  { value: "year", label: "Год" }
];

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

export default function OutgoingFlowDashboard() {
  const { user, role } = useOutletContext();
  const [timePeriod, setTimePeriod] = useState("week");
  const [stats, setStats] = useState({ pending: 0, inProgress: 0, processed: 0, shipped: 0 });
  const [recentRequests, setRecentRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [timePeriod, user?.email, role]);

  const loadData = async () => {
    try {
      setLoading(true);
      const isClient = role === "client";
      const orders = isClient
        ? await db.entities.AssemblyOrder.filter({ client_email: user?.email }, '-created_date', 50)
        : await db.entities.AssemblyOrder.list('-created_date', 50);

      // Фильтрация по периоду времени
      const now = new Date();
      const periodStart = new Date();

      switch (timePeriod) {
        case "week":
          periodStart.setDate(now.getDate() - 7);
          break;
        case "month":
          periodStart.setMonth(now.getMonth() - 1);
          break;
        case "quarter":
          periodStart.setMonth(now.getMonth() - 3);
          break;
        case "year":
          periodStart.setFullYear(now.getFullYear() - 1);
          break;
      }

      const filteredOrders = orders.filter(order => {
        const orderDate = new Date(order.created_date);
        return orderDate >= periodStart;
      }).map((order) => ({
        ...order,
        status: normalizeOutgoingStatus(order.status),
      }));

      // Подсчет статистики
      const pending = filteredOrders.filter(order => order.status === "новая").length;
      const inProgress = filteredOrders.filter(order => order.status === "взята в работу").length;
      const processed = filteredOrders.filter(order => ["упаковано", "собрано", "готова к отгрузке"].includes(order.status)).length;
      const shipped = filteredOrders.filter(order => order.status === "отгружено").length;

      setStats({ pending, inProgress, processed, shipped });
      setRecentRequests(filteredOrders.slice(0, 5));
    } catch (error) {
      console.error("Error loading outgoing flow data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "новая":
        return <Badge variant="secondary">На отгрузку</Badge>;
      case "взята в работу":
        return <Badge variant="default">Взята в работу</Badge>;
      case "упаковано":
      case "собрано":
      case "готова к отгрузке":
        return <Badge variant="outline" className="text-blue-600 border-blue-600">Обработана</Badge>;
      case "отгружено":
        return <Badge variant="outline" className="text-green-600 border-green-600">Отгружена</Badge>;
      case "отменена":
        return <Badge variant="destructive">Отменена</Badge>;
      default:
        return <Badge variant="secondary">Неизвестно</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка данных...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Исходящий поток</h1>
          <p className="text-muted-foreground">
            Мониторинг заявок на отгрузку товаров
          </p>
        </div>
        <Select value={timePeriod} onValueChange={setTimePeriod}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Выберите период" />
          </SelectTrigger>
          <SelectContent>
            {TIME_PERIODS.map((period) => (
              <SelectItem key={period.value} value={period.value}>
                {period.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">На отгрузку</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">
              заявок ожидают
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">В обработке</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
            <p className="text-xs text-muted-foreground">
              заявок обрабатываются
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Обработанные</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.processed}</div>
            <p className="text-xs text-muted-foreground">
              заявок обработано
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Отгруженные</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.shipped}</div>
            <p className="text-xs text-muted-foreground">
              заявок отгружено
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Последние заявки</CardTitle>
          <CardDescription>
            Список последних заявок на отгрузку
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentRequests.map((order) => (
              <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{order.client_name}</p>
                  <p className="text-sm text-muted-foreground">
                    №{order.order_number} • {order.items?.length || 0} товаров
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Truck className="h-3 w-3" />
                    {order.created_date ? new Date(order.created_date).toLocaleDateString('ru-RU') : 'Дата неизвестна'}
                  </div>
                </div>
                {getStatusBadge(order.status)}
              </div>
            ))}
            {recentRequests.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                Нет заявок за выбранный период
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}