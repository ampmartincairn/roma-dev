import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { db } from "@/api/base44Client";
import { Search, History } from "lucide-react";
import { Input } from "@/components/ui/input";
import PageHeader from "../components/wms/PageHeader";
import EmptyState from "../components/wms/EmptyState";
import moment from "moment";

export default function LogsPage() {
  const { role } = useOutletContext();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      const data = await db.entities.ActionLog.list("-created_date", 200);
      setLogs(data);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = logs.filter((l) => {
    return !search ||
      l.user_name?.toLowerCase().includes(search.toLowerCase()) ||
      l.user_email?.toLowerCase().includes(search.toLowerCase()) ||
      l.action?.toLowerCase().includes(search.toLowerCase()) ||
      l.details?.toLowerCase().includes(search.toLowerCase());
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
      <PageHeader title="Журнал действий" description="Лог всех действий пользователей в системе" />

      <div className="relative max-w-md mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Поиск по действию, пользователю..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={History} title="Нет записей" description="Действия пользователей будут отображаться здесь" />
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Время</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Пользователь</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Действие</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Подробности</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 text-muted-foreground text-xs whitespace-nowrap">
                      {moment(l.created_date).format("DD.MM.YY HH:mm")}
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-xs">{l.user_name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{l.user_email}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium">{l.action}</td>
                    <td className="py-3 px-4 hidden md:table-cell text-muted-foreground">{l.details || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}