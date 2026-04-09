import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/api/base44Client";

const ROLES = [
  { value: "admin", label: "Администратор" },
  { value: "manager", label: "Сотрудник склада" },
  { value: "client", label: "Клиент" }
];

export default function UserForm({ user, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    full_name: "",
    role: "client",
    company_name: "",
    is_active: true,
    client_id: null
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || "",
        email: user.email || "",
        password: "",
        full_name: user.full_name || "",
        role: user.role || "client",
        company_name: user.company_name || "",
        is_active: user.is_active !== undefined ? user.is_active : true,
        client_id: user.client_id || null
      });
    }
  }, [user]);

  const handleInputChange = (field, value) => {
    setFormData(prev => {
      if (field === "role") {
        return {
          ...prev,
          role: value,
          company_name: value === "manager" ? "" : prev.company_name
        };
      }

      return {
        ...prev,
        [field]: value
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (user) {
        // Обновление пользователя
        const updateData = {
          email: formData.email,
          full_name: formData.full_name,
          role: formData.role,
          company_name: formData.company_name,
          is_active: formData.is_active,
          client_id: formData.client_id
        };

        // Если указан новый пароль, добавляем его
        if (formData.password) {
          updateData.password = formData.password;
        }

        await db.entities.User.update(user.id, updateData);
      } else {
        // Создание нового пользователя
        if (!formData.password) {
          alert("Пароль обязателен для нового пользователя");
          setLoading(false);
          return;
        }

        await db.auth.register(
          formData.username,
          formData.email,
          formData.password,
          formData.full_name,
          formData.role
        );

        // Обновляем дополнительные поля
        const users = await db.entities.User.filter({ username: formData.username });
        if (users.length > 0) {
          const newUser = users[0];
          await db.entities.User.update(newUser.id, {
            company_name: formData.company_name,
            is_active: formData.is_active,
            client_id: formData.client_id
          });
        }
      }

      onSubmit();
    } catch (error) {
      console.error("Error saving user:", error);
      alert("Ошибка при сохранении пользователя: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="username">Имя пользователя *</Label>
          <Input
            id="username"
            value={formData.username}
            onChange={(e) => handleInputChange("username", e.target.value)}
            disabled={!!user} // Нельзя менять username при редактировании
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange("email", e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="full_name">ФИО</Label>
          <Input
            id="full_name"
            value={formData.full_name}
            onChange={(e) => handleInputChange("full_name", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="role">Роль *</Label>
          <Select value={formData.role} onValueChange={(value) => handleInputChange("role", value)}>
            <SelectTrigger>
              <SelectValue placeholder="Выберите роль" />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((role) => (
                <SelectItem key={role.value} value={role.value}>
                  {role.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="password">
            {user ? "Новый пароль (оставьте пустым, чтобы не менять)" : "Пароль *"}
          </Label>
          <Input
            id="password"
            type="password"
            value={formData.password}
            onChange={(e) => handleInputChange("password", e.target.value)}
            required={!user}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="company_name">Компания</Label>
          <Input
            id="company_name"
            value={formData.company_name}
            onChange={(e) => handleInputChange("company_name", e.target.value)}
            disabled={formData.role === "manager"}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Настройки доступа</CardTitle>
          <CardDescription>
            Управление доступом пользователя к системе
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => handleInputChange("is_active", checked)}
            />
            <Label htmlFor="is_active" className="text-sm font-medium">
              Активен
            </Label>
            <span className="text-sm text-muted-foreground">
              (если отключено, пользователь не сможет войти в систему)
            </span>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Функция привязки пользователя к клиенту будет добавлена в будущих версиях
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Сохранение..." : (user ? "Сохранить" : "Создать")}
        </Button>
      </div>
    </form>
  );
}