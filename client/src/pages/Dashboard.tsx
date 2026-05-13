import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, StatusDot } from "@/components/StatusBadge";
import { trpc } from "@/lib/trpc";
import { useAppAuth } from "@/contexts/AuthContext";
import { CONTRACT_STATUSES, ContractStatus } from "@shared/contracts";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { ru } from "date-fns/locale";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  FileText,
  Clock,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<ContractStatus, string> = {
  draft: "#9ca3af",
  pending_customer: "#3b82f6",
  pending_contractor: "#6366f1",
  awaiting_payment: "#eab308",
  paid: "#22c55e",
  in_progress: "#f97316",
  act_signing: "#8b5cf6",
  completed: "#10b981",
  rejected: "#ef4444",
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAppAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const { data: dashboardData, isLoading } = trpc.dashboard.stats.useQuery();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  // Calendar data
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const getEventsForDay = (day: Date) => {
    if (!dashboardData?.calendarEvents) return [];
    return dashboardData.calendarEvents.filter((event) => {
      const eventDate = new Date(event.date);
      return isSameDay(eventDate, day);
    });
  };

  const getDeadlinesForDay = (day: Date) => {
    if (!dashboardData?.calendarEvents) return [];
    return dashboardData.calendarEvents.filter((event) => {
      if (!event.validUntil) return false;
      const deadline = new Date(event.validUntil);
      return isSameDay(deadline, day);
    });
  };

  // Pie chart data
  const pieData = useMemo(() => {
    if (!dashboardData?.stats.byStatus) return [];
    return dashboardData.stats.byStatus.map((item) => ({
      name: CONTRACT_STATUSES[item.status as ContractStatus]?.label || item.status,
      value: item.count,
      color: STATUS_COLORS[item.status as ContractStatus] || "#9ca3af",
    }));
  }, [dashboardData]);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Дашборд</h1>
          <p className="text-muted-foreground mt-1">
            Обзор договоров и аналитика
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="card-hover">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Всего договоров</p>
                      <p className="text-2xl font-bold">{dashboardData?.stats.total || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-hover">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Общая сумма</p>
                      <p className="text-2xl font-bold">
                        {formatAmount(dashboardData?.totalAmount || 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-hover">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                      <Clock className="w-6 h-6 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">В работе</p>
                      <p className="text-2xl font-bold">
                        {dashboardData?.stats.byStatus.find(s => s.status === "in_progress")?.count || 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-hover">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Срочные</p>
                      <p className="text-2xl font-bold">
                        {dashboardData?.urgentContracts.length || 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Calendar */}
              <Card className="lg:col-span-1">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Календарь договоров
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm font-medium min-w-[120px] text-center">
                      {format(currentMonth, "LLLL yyyy", { locale: ru })}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Weekday headers */}
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
                      <div
                        key={day}
                        className="text-center text-xs font-medium text-muted-foreground py-2"
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Calendar grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {/* Empty cells for days before month start */}
                    {Array.from({ length: (calendarDays[0].getDay() + 6) % 7 }).map((_, i) => (
                      <div key={`empty-${i}`} className="aspect-square" />
                    ))}

                    {calendarDays.map((day) => {
                      const events = getEventsForDay(day);
                      const deadlines = getDeadlinesForDay(day);
                      const isToday = isSameDay(day, new Date());

                      return (
                        <div
                          key={day.toISOString()}
                          className={cn(
                            "aspect-square p-1 rounded-lg border border-transparent",
                            "hover:border-primary/20 hover:bg-accent/50 transition-colors",
                            isToday && "bg-primary/5 border-primary/30"
                          )}
                        >
                          <div className="h-full flex flex-col">
                            <span
                              className={cn(
                                "text-xs font-medium",
                                isToday && "text-primary"
                              )}
                            >
                              {format(day, "d")}
                            </span>
                            <div className="flex-1 flex flex-wrap gap-0.5 mt-0.5">
                              {events.slice(0, 2).map((event) => (
                                <StatusDot
                                  key={`event-${event.id}`}
                                  status={event.status as ContractStatus}
                                />
                              ))}
                              {deadlines.slice(0, 2).map((event) => (
                                <span
                                  key={`deadline-${event.id}`}
                                  className="w-2 h-2 rounded-full bg-red-500"
                                  title={`Срок: ${event.title}`}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Legend */}
                  <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-muted-foreground">Согласование</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-muted-foreground">Исполнение</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      <span className="text-muted-foreground">Срок</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Pie Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Распределение по статусам</CardTitle>
                </CardHeader>
                <CardContent>
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => [`${value} договоров`, ""]}
                        />
                        <Legend
                          layout="vertical"
                          align="right"
                          verticalAlign="middle"
                          formatter={(value) => (
                            <span className="text-sm">{value}</span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      Нет данных для отображения
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Urgent Tasks */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  Срочные задачи (в течение 48 часов)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dashboardData?.urgentContracts && dashboardData.urgentContracts.length > 0 ? (
                  <div className="space-y-3">
                    {dashboardData.urgentContracts.map((contract) => (
                      <div
                        key={contract.id}
                        className="flex items-center justify-between p-4 rounded-lg border bg-orange-50/50 hover:bg-orange-50 transition-colors cursor-pointer"
                        onClick={() => setLocation("/contracts")}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-orange-600" />
                          </div>
                          <div>
                            <p className="font-medium">{contract.contractNumber}</p>
                            <p className="text-sm text-muted-foreground truncate max-w-md">
                              {contract.subject}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <StatusBadge status={contract.status as ContractStatus} size="sm" />
                          <div className="text-right">
                            <p className="text-sm font-medium text-orange-600">
                              Срок: {contract.validUntil ? format(new Date(contract.validUntil), "dd.MM.yyyy") : "—"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Нет срочных задач</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
