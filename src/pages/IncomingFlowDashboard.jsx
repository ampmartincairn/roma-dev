import { useState, useEffect } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, CheckCircle, Package, CalendarDays, Plus, Trash2 } from "lucide-react";
import { db } from "@/api/base44Client";
import StatusBadge from "@/components/wms/StatusBadge";
import { toast } from "sonner";

const TIME_PERIODS = [
  { value: "week", label: "Неделя" },
  { value: "month", label: "Месяц" },
  { value: "quarter", label: "Квартал" },
  { value: "year", label: "Год" }
];

export default function IncomingFlowDashboard() {
  const navigate = useNavigate();
  const { user, role } = useOutletContext();
  const [timePeriod, setTimePeriod] = useState("week");
  const [stats, setStats] = useState({ pending: 0, inProgress: 0, completed: 0 });
  const [recentRequests, setRecentRequests] = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [timePeriod, user?.email, role]);

  const handleNewRequest = () => {
    navigate("/incoming-flow/new");
  };

  const handleRowClick = (requestId) => {
    navigate(`/incoming-flow/${requestId}`);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const isClient = role === "client";
      const requests = isClient
        ? await db.entities.ReceptionRequest.filter({ client_email: user?.email }, '-created_date', 1000)
        : await db.entities.ReceptionRequest.list('-created_date', 1000);

      // Фильтрация по периоду времени для статистики
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

      const filteredRequests = requests.filter(req => {
        const reqDate = new Date(req.created_date);
        return reqDate >= periodStart;
      });

      // Подсчет статистики
      const pending = filteredRequests.filter(req => req.status === "новая" || req.status === "создана" || req.status === "Создана").length;
      const inProgress = filteredRequests.filter(req => req.status === "взята в работу" || req.status === "Взята в работу").length;
      const completed = filteredRequests.filter(req => req.status === "принята" || req.status === "Принята").length;

      setStats({ pending, inProgress, completed });
      setRecentRequests(filteredRequests.slice(0, 5));
      setAllRequests(filteredRequests);
    } catch (error) {
      console.error("Error loading incoming flow data:", error);
    } finally {
      setLoading(false);
    }
  };

  const canDeleteRequest = (request) => {
    if (role === "admin") return true;
    if (role === "client") {
      return request.status === "новая" || request.status === "создана" || request.status === "Создана";
    }
    return false;
  };

  const handleDeleteRequest = async (request) => {
    if (!canDeleteRequest(request)) return;
    if (!confirm(`Удалить заявку ${request.request_number || request.id}?`)) return;

    try {
      setLoading(true);
      await db.entities.ReceptionRequest.delete(request.id);
      toast.success("Заявка удалена");
      loadData();
    } catch (error) {
      console.error("Error deleting request:", error);
      toast.error("Не удалось удалить заявку");
      setLoading(false);
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
          <h1 className="text-3xl font-bold tracking-tight">Входящий поток</h1>
          <p className="text-muted-foreground">
            Мониторинг заявок на приемку товаров
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Обзор</TabsTrigger>
          <TabsTrigger value="requests">Заявки на приемку</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Статистика</h2>
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

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Не обработанные</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
                <p className="text-xs text-muted-foreground">
                  заявок ожидают обработки
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">В работе</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
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
                <CardTitle className="text-sm font-medium">Принятые</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
                <p className="text-xs text-muted-foreground">
                  заявок принято за период
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Последние заявки</CardTitle>
              <CardDescription>
                Список последних заявок на приемку
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentRequests.map((request) => (
                  <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{request.client_name}</p>
                      <p className="text-sm text-muted-foreground">
                        №{request.request_number} • {request.items?.length || 0} товаров
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CalendarDays className="h-3 w-3" />
                        {request.created_date ? new Date(request.created_date).toLocaleDateString('ru-RU') : 'Дата неизвестна'}
                      </div>
                    </div>
                    <StatusBadge status={request.status} />
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
        </TabsContent>

        <TabsContent value="requests" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Заявки на приемку</h2>
            {role !== "operator" && (
              <Button className="bg-green-600 hover:bg-green-700" onClick={handleNewRequest}>
                <Plus className="h-4 w-4 mr-2" />
                Новая
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full table-auto">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">ID документа</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Номер заявки</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Дата и время заявки</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Клиент</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Статус</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Дата и время начала обработки</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allRequests.map((request) => (
                      <tr key={request.id} className="border-b hover:bg-muted/50">
                        <td className="p-4 align-middle font-medium whitespace-nowrap">
                          <Link
                            to={`/incoming-flow/${request.id}`}
                            className="text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {request.id}
                          </Link>
                        </td>
                        <td className="p-4 align-middle whitespace-nowrap">{request.request_number || '-'}</td>
                        <td className="p-4 align-middle">
                          {request.created_date ? new Date(request.created_date).toLocaleString('ru-RU') : '-'}
                        </td>
                        <td className="p-4 align-middle">{request.client_name || '-'}</td>
                        <td className="p-4 align-middle whitespace-nowrap">
                          <StatusBadge status={request.status} />
                        </td>
                        <td className="p-4 align-middle">
                          {request.sent_to_work_date ? new Date(request.sent_to_work_date).toLocaleString('ru-RU') : '-'}
                        </td>
                        <td className="p-4 align-middle whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {(role === "admin" || role === "operator") ? (
                              <Button variant="outline" size="sm" onClick={() => handleRowClick(request.id)}>
                                Открыть
                              </Button>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                            {canDeleteRequest(request) && role === "admin" && (
                              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteRequest(request)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {allRequests.length === 0 && (
                      <tr>
                        <td colSpan={6} className="h-24 text-center text-muted-foreground">
                          Нет заявок на приемку
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}