import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, UserCheck, UserX, Shield } from "lucide-react";
import { db } from "@/api/base44Client";
import UserForm from "@/components/UserForm";
import { useAuth } from "@/lib/AuthContext";

export default function UsersManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { user: currentUser } = useAuth();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const usersData = await db.entities.User.list('-created_date');
      setUsers(usersData);
    } catch (error) {
      console.error("Error loading users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = () => {
    setSelectedUser(null);
    setIsDialogOpen(true);
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setIsDialogOpen(true);
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm("Вы уверены, что хотите удалить этого пользователя?")) {
      try {
        await db.entities.User.delete(userId);
        await loadUsers();
      } catch (error) {
        console.error("Error deleting user:", error);
        alert("Ошибка при удалении пользователя");
      }
    }
  };

  const handleFormSubmit = useCallback(async () => {
    try {
      setIsDialogOpen(false);
      await loadUsers();
    } catch (error) {
      console.error("Error in handleFormSubmit:", error);
    }
  }, []);

  const getRoleBadge = (role) => {
    switch (role) {
      case "admin":
        return <Badge variant="destructive">Администратор</Badge>;
      case "manager":
        return <Badge variant="default">Сотрудник склада</Badge>;
      case "client":
        return <Badge variant="secondary">Клиент</Badge>;
      default:
        return <Badge variant="outline">Неизвестно</Badge>;
    }
  };

  const getStatusBadge = (user) => {
    // Для обратной совместимости, если поле is_active не существует
    const isActive = user.is_active !== undefined ? user.is_active : true;
    return isActive ? (
      <Badge variant="outline" className="text-green-600 border-green-600">
        <UserCheck className="h-3 w-3 mr-1" />
        Активен
      </Badge>
    ) : (
      <Badge variant="outline" className="text-red-600 border-red-600">
        <UserX className="h-3 w-3 mr-1" />
        Неактивен
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка пользователей...</p>
        </div>
      </div>
    );
  }

  // Check if user is admin
  if (currentUser?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-lg font-semibold">Доступ запрещен</p>
          <p className="text-muted-foreground">Только администраторы могут управлять безопасностью</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold tracking-tight">Безопасность</h1>
            </div>
            <p className="text-muted-foreground">
              Управление доступом и пользователями системы
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Пользователи системы</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-end mb-4">
              <Button onClick={handleCreateUser}>
                <Plus className="h-4 w-4 mr-2" />
                Добавить пользователя
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Имя пользователя</TableHead>
                  <TableHead>ФИО</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Роль</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Компания</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell>{user.full_name || "Не указано"}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell>{getStatusBadge(user)}</TableCell>
                    <TableCell>{user.company_name || "Не указано"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditUser(user)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {users.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Пользователи не найдены</p>
                <Button onClick={handleCreateUser} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Создать первого пользователя
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedUser ? "Редактирование пользователя" : "Создание пользователя"}
            </DialogTitle>
            <DialogDescription>
              {selectedUser
                ? "Измените данные пользователя"
                : "Заполните данные для создания нового пользователя"
              }
            </DialogDescription>
          </DialogHeader>
          {isDialogOpen && (
            <div className="max-h-[60vh] overflow-y-auto">
              <UserForm
                user={selectedUser}
                onSubmit={handleFormSubmit}
                onCancel={() => setIsDialogOpen(false)}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}