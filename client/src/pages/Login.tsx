import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { FileText, Lock, User, Building2, Loader2, Shield } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const { login, isAuthenticated } = useAppAuth();
  const [loginInput, setLoginInput] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Seed predefined users on first load
  const seedMutation = trpc.predefinedUsers.initializeUsers.useMutation();

  useEffect(() => {
    // Seed users when component mounts
    seedMutation.mutate();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      setLocation("/contracts");
    }
  }, [isAuthenticated, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const success = await login(loginInput, password);
    
    if (success) {
      toast.success("Добро пожаловать!");
      setLocation("/contracts");
    } else {
      toast.error("Неверный логин или пароль");
    }
    
    setIsSubmitting(false);
  };

  const quickLogin = async (userLogin: string, userPassword: string) => {
    setLoginInput(userLogin);
    setPassword(userPassword);
    setIsSubmitting(true);

    const success = await login(userLogin, userPassword);
    
    if (success) {
      toast.success("Добро пожаловать!");
      setLocation("/contracts");
    } else {
      toast.error("Ошибка входа");
    }
    
    setIsSubmitting(false);
  };

  const predefinedUsers = [
    {
      login: "it_head",
      password: "it@rogakopita",
      title: "Начальник управления ИТ",
      organization: 'ООО "Рога и копыта"',
      organizationInn: "7707083893",
      icon: User,
      canApprove: false,
    },
    {
      login: "director_roga",
      password: "dir@rogakopita",
      title: "Директор",
      organization: 'ООО "Рога и копыта"',
      organizationInn: "7707083893",
      icon: Building2,
      canApprove: true,
    },
    {
      login: "director_hlyp",
      password: "dir@hlyp",
      title: "Директор",
      organization: 'Хлыпало и КО',
      organizationInn: "1111111111",
      icon: Building2,
      canApprove: true,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-8 relative">
        {/* Left side - Branding */}
        <div className="hidden lg:flex flex-col justify-center space-y-8 p-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
                <FileText className="w-6 h-6 text-primary-foreground" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">
                Система управления договорами
              </h1>
            </div>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Современное решение для управления жизненным циклом договоров: 
              от создания до завершения исполнения.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 rounded-xl bg-white/50 border border-border/50">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium">Автоматизация документооборота</h3>
                <p className="text-sm text-muted-foreground">
                  Автоматическая генерация договоров и актов выполненных работ
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-xl bg-white/50 border border-border/50">
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-medium">Контроль согласования</h3>
                <p className="text-sm text-muted-foreground">
                  Прозрачный workflow с отслеживанием статусов и уведомлениями
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-xl bg-white/50 border border-border/50">
              <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-medium">Разграничение прав доступа</h3>
                <p className="text-sm text-muted-foreground">
                  Каждый пользователь видит только договоры своей организации
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Login form */}
        <div className="flex flex-col justify-center">
          <Card className="elegant-shadow border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="space-y-1 pb-6">
              <div className="lg:hidden flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="font-semibold text-lg">Договоры</span>
              </div>
              <CardTitle className="text-2xl">Вход в систему</CardTitle>
              <CardDescription>
                Введите учетные данные или выберите пользователя
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login">Логин</Label>
                  <Input
                    id="login"
                    type="text"
                    placeholder="Введите логин"
                    value={loginInput}
                    onChange={(e) => setLoginInput(e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Пароль</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Введите пароль"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full h-11" 
                  disabled={isSubmitting || !loginInput || !password}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Вход...
                    </>
                  ) : (
                    "Войти"
                  )}
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-muted-foreground">
                    Быстрый вход
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                {predefinedUsers.map((user) => (
                  <button
                    key={user.login}
                    onClick={() => quickLogin(user.login, user.password)}
                    disabled={isSubmitting}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-accent hover:border-primary/20 transition-all text-left group disabled:opacity-50"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <user.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{user.title}</p>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.organization} (ИНН: {user.organizationInn})
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
