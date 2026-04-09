import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import { db } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";

export default function NewReceptionRequest() {
  const navigate = useNavigate();
  const { user, isLoadingAuth } = useAuth();
  const [loading, setLoading] = useState(false);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [selectedProductSku, setSelectedProductSku] = useState("");
  const [productQty, setProductQty] = useState(1);
  const [formData, setFormData] = useState({
    request_number: "",
    client_name: user?.company_name || "",
    client_email: user?.email || "",
    comment: "",
    items: []
  });
  const isClient = user?.role === "user" || user?.role === "client";
  const isClientActive = !isClient || user?.is_active === true;

  const handleLoadProducts = async (email) => {
    if (!email) {
      setAvailableProducts([]);
      setSelectedProductSku("");
      return;
    }

    try {
      const products = await db.entities.Product.filter({ client_email: email }, "name", 1000);
      setAvailableProducts(products);
      if (!products.some((product) => product.sku === selectedProductSku)) {
        setSelectedProductSku("");
      }
    } catch (error) {
      console.error("Ошибка загрузки товаров:", error);
      setAvailableProducts([]);
    }
  };

  useEffect(() => {
    if (!user) {
      return;
    }

    const targetEmail = isClient ? user.email : formData.client_email;
    handleLoadProducts(targetEmail);
  }, [user, isClient, formData.client_email]);

  useEffect(() => {
    const loadNextClientRequestNumber = async () => {
      if (!isClient || !user?.email) return;

      try {
        const requests = await db.entities.ReceptionRequest.filter(
          { client_email: user.email },
          "-created_date",
          1000
        );

        const numericNumbers = requests
          .map((r) => Number(r.request_number))
          .filter((n) => Number.isFinite(n) && n > 0);

        const nextNumber = numericNumbers.length > 0
          ? String(Math.max(...numericNumbers) + 1)
          : String(requests.length + 1);

        setFormData((prev) => ({ ...prev, request_number: nextNumber }));
      } catch (error) {
        console.error("Ошибка авто-нумерации заявки:", error);
      }
    };

    loadNextClientRequestNumber();
  }, [isClient, user?.email]);

  if (isLoadingAuth) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка пользователя...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Пользователь не найден. Пожалуйста, войдите снова.
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isClient && !isClientActive) {
      alert("Аккаунт не активирован. Создание заявок недоступно.");
      return;
    }

    setLoading(true);

    try {
      const requestNumber = isClient
        ? formData.request_number || "1"
        : formData.request_number;

      const requestData = {
        ...formData,
        request_number: requestNumber,
        reception_type: "приемка",
        status: "новая",
        created_date: new Date().toISOString()
      };

      await db.entities.ReceptionRequest.create(requestData);
      navigate("/incoming-flow");
    } catch (error) {
      console.error("Error creating reception request:", error);
      alert("Ошибка при создании заявки");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
      ...(field === "client_email" ? { items: [] } : {})
    }));
  };

  const handleAddItem = () => {
    if (!selectedProductSku || productQty <= 0) {
      return;
    }

    const product = availableProducts.find((item) => item.sku === selectedProductSku);
    if (!product) {
      return;
    }

    const newItem = {
      product_name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      expected_qty: Number(productQty),
      weight_kg: product.weight_kg ? Number(product.weight_kg) : undefined
    };

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
    setSelectedProductSku("");
    setProductQty(1);
  };

  const handleRemoveItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index)
    }));
  };

  const renderContent = () => {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate("/incoming-flow")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Назад
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Новая заявка на приемку</h1>
          <p className="text-muted-foreground">
            Создание новой заявки на приемку товаров
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Основная информация</CardTitle>
              <CardDescription>
                Заполните основную информацию о заявке
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="request_number">Номер заявки</Label>
                  <Input
                    id="request_number"
                    value={formData.request_number}
                    onChange={(e) => handleChange("request_number", e.target.value)}
                    placeholder={isClient ? "Присваивается автоматически" : "Введите номер заявки"}
                    required
                    disabled={isClient}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client_name">Название компании</Label>
                  <Input
                    id="client_name"
                    value={formData.client_name}
                    onChange={(e) => handleChange("client_name", e.target.value)}
                    placeholder="Введите название компании"
                    required
                    disabled={isClient}
                  />
                </div>
              </div>

              {!isClient && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="client_email">Email клиента</Label>
                    <Input
                      id="client_email"
                      value={formData.client_email}
                      onChange={(e) => handleChange("client_email", e.target.value)}
                      placeholder="Введите email клиента"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="comment">Комментарий</Label>
                <Textarea
                  id="comment"
                  value={formData.comment}
                  onChange={(e) => handleChange("comment", e.target.value)}
                  placeholder="Дополнительная информация"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Товары</CardTitle>
              <CardDescription>
                Добавьте товары в табличную часть заявки
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="product">Товар</Label>
                  <Select value={selectedProductSku} onValueChange={setSelectedProductSku}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите товар" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProducts.map((product) => (
                        <SelectItem key={product.sku} value={product.sku}>
                          {product.name} — {product.sku}
                        </SelectItem>
                      ))}
                      {availableProducts.length === 0 && (
                        <SelectItem value="no-products" disabled>
                          Товары не найдены
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product_quantity">Количество</Label>
                  <Input
                    id="product_quantity"
                    type="number"
                    min={1}
                    value={productQty}
                    onChange={(e) => setProductQty(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="button" onClick={handleAddItem} disabled={!selectedProductSku || productQty <= 0}>
                  Добавить товар
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-2 text-xs font-medium text-muted-foreground">SKU</th>
                      <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Название</th>
                      <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Штрихкод</th>
                      <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Кол-во</th>
                      <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.map((item, index) => (
                      <tr key={`${item.sku}-${index}`} className="border-t">
                        <td className="px-4 py-3">{item.sku}</td>
                        <td className="px-4 py-3">{item.product_name}</td>
                        <td className="px-4 py-3">{item.barcode || '-'}</td>
                        <td className="px-4 py-3">{item.expected_qty}</td>
                        <td className="px-4 py-3">
                          <Button type="button" variant="outline" onClick={() => handleRemoveItem(index)}>
                            Удалить
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {formData.items.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">
                          Добавьте товар в заявку
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => navigate("/incoming-flow")}>
              Отмена
            </Button>
            <Button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-700">
              <Save className="h-4 w-4 mr-2" />
              {loading ? "Создание..." : "Создать заявку"}
            </Button>
          </div>
        </div>
      </form>

      {isClient && !isClientActive && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Создание заявок недоступно, пока администратор не активирует ваш аккаунт.
        </div>
      )}
    </div>
  );
  };

  try {
    return renderContent();
  } catch (error) {
    console.error("NewReceptionRequest render error:", error);
    return (
      <div className="p-6 bg-red-50 text-red-700 rounded-lg border border-red-200">
        <h2 className="text-lg font-semibold mb-2">Ошибка рендеринга страницы</h2>
        <pre className="whitespace-pre-wrap text-sm">{String(error)}</pre>
      </div>
    );
  }
}