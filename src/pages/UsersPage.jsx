import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Search, Users, UserPlus, Shield, User, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PageHeader from "../components/wms/PageHeader";
import EmptyState from "../components/wms/EmptyState";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const ROLE_CONFIG = {
  admin: { label: "Администратор", icon: Shield, color: "text-wms-danger" },
  operator: { label: "Оператор", icon: Headphones, color: "text-wms-blue" },
  client: { label: "Клиент", icon: User, color: "text-wms-success" },
};

export default function UsersPage() {
  const { role } = useOutletContext();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("client");
  const [inviting, setInviting] = useState(false);

  const loadData = async () => {
    const data = await base44.entities.User.list("-created_date", 200);
    setUsers(data);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviting(true);
    await base44.users.inviteUser(inviteEmail, inviteRole === "client" ? "user" : inviteRole === "admin" ? "admin" : "user");

    if (inviteRole === "operator") {
      const allUsers = await base44.entities.User.list("-created_date", 200);
      const invited = allUsers.find(u => u.email === inviteEmail);
      if (invited) {
        await base44.entities.User.update(invited.id, { role: "operator" });
      }
    }

    toast.success(`Приглашение отправлено на ${inviteEmail}`);
    setShowInvite(false);
    setInviteEmail("");
    setInviting(false);
    loadData();
  };

  const updateUserRole = async (userId, newRole) => {
    await base44.entities.User.update(userId, { role: newRole });
    toast.success("Роль обновлена");
    loadData();
  };

  const filtered = users.filter((u) => {
    const matchSearch = !search ||
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || (u.role || "client") === roleFilter;
    return matchSearch && matchRole;
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
        title="Пользователи"
        description="Управление пользователями системы"
        actions={
          role === "admin" && (
            <Button onClick={() => setShowInvite(true)}>
              <UserPlus className="h-4 w-4 mr-2" /> Пригласить
            </Button>
          )
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Поиск по имени или email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все роли</SelectItem>
            <SelectItem value="admin">Администраторы</SelectItem>
            <SelectItem value="operator">Операторы</SelectItem>
            <SelectItem value="client">Клиенты</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="Нет пользователей" description="Пригласите первого пользователя" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((u) => {
            const rc = ROLE_CONFIG[u.role] || ROLE_CONFIG["client"];
            const RoleIcon = rc.icon;
            return (
              <div key={u.id} className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-all hover:border-primary/20">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                    {u.full_name?.[0] || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{u.full_name || "Без имени"}</p>
                    <p className="text-sm text-muted-foreground truncate">{u.email}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <RoleIcon className={cn("h-3.5 w-3.5", rc.color)} />
                      <span className="text-xs font-medium">{rc.label}</span>
                    </div>
                    {u.company_name && <p className="text-xs text-muted-foreground mt-1">{u.company_name}</p>}
                  </div>
                </div>
                {role === "admin" && (
                  <div className="mt-4 pt-3 border-t">
                    <Select value={u.role || "client"} onValueChange={(v) => updateUserRole(u.id, v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Администратор</SelectItem>
                        <SelectItem value="operator">Оператор</SelectItem>
                        <SelectItem value="client">Клиент</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent>
          <DialogHeader><DialogTitle>Пригласить пользователя</DialogTitle></DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="email@example.com" required />
            </div>
            <div className="space-y-2">
              <Label>Роль</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Администратор</SelectItem>
                  <SelectItem value="operator">Оператор</SelectItem>
                  <SelectItem value="client">Клиент</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowInvite(false)}>Отмена</Button>
              <Button type="submit" disabled={inviting}>{inviting ? "Отправка..." : "Пригласить"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}