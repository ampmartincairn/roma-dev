import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Warehouse, AlertCircle } from 'lucide-react';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, error } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    password_confirm: '',
    full_name: ''
  });
  const [validationError, setValidationError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setValidationError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.username.trim()) {
      setValidationError('Введите имя пользователя');
      return;
    }
    if (!formData.email.trim()) {
      setValidationError('Введите email');
      return;
    }
    if (!formData.password) {
      setValidationError('Введите пароль');
      return;
    }
    if (formData.password !== formData.password_confirm) {
      setValidationError('Пароли не совпадают');
      return;
    }
    if (formData.password.length < 6) {
      setValidationError('Пароль должен быть не менее 6 символов');
      return;
    }
    if (!formData.full_name.trim()) {
      setValidationError('Введите полное имя');
      return;
    }

    setLoading(true);
    try {
      await register(
        formData.username,
        formData.email,
        formData.password,
        formData.full_name,
        'user'
      );
      navigate('/');
    } catch (err) {
      console.error('Register failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Warehouse className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">WMS</h1>
              <p className="text-xs text-muted-foreground">Fulfillment</p>
            </div>
          </div>
          <CardTitle className="text-2xl">Регистрация</CardTitle>
          <CardDescription>Создайте новый аккаунт</CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {(error || validationError) && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error || validationError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Имя пользователя</Label>
              <Input
                id="username"
                name="username"
                type="text"
                placeholder="Введите имя пользователя"
                value={formData.username}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="full_name">Полное имя</Label>
              <Input
                id="full_name"
                name="full_name"
                type="text"
                placeholder="Введите полное имя"
                value={formData.full_name}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="Введите email"
                value={formData.email}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Введите пароль"
                value={formData.password}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password_confirm">Подтверждение пароля</Label>
              <Input
                id="password_confirm"
                name="password_confirm"
                type="password"
                placeholder="Подтвердите пароль"
                value={formData.password_confirm}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Загрузка...' : 'Зарегистрироваться'}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-background text-muted-foreground">
                Уже есть аккаунт?
              </span>
            </div>
          </div>

          <Link to="/login">
            <Button variant="outline" className="w-full">
              Войти в систему
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
