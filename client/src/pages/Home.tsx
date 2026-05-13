import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAppAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export default function Home() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAppAuth();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        setLocation("/contracts");
      } else {
        setLocation("/login");
      }
    }
  }, [isAuthenticated, isLoading, setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-purple-50">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    </div>
  );
}
