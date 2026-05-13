import { useAppAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Bell, CheckCheck, FileText, MessageSquare, RefreshCw, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Layout } from "@/components/Layout";

export default function Notifications() {
  const { currentUser: user } = useAppAuth();
  const utils = trpc.useUtils();
  
  const { data: notifications, isLoading } = trpc.notifications.list.useQuery(
    { userInn: user?.organizationInn || "" },
    { enabled: !!user?.organizationInn }
  );

  const markAsReadMutation = trpc.notifications.markAsRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const markAllAsReadMutation = trpc.notifications.markAllAsRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "status_change":
        return <RefreshCw className="h-5 w-5 text-blue-500" />;
      case "comment_added":
        return <MessageSquare className="h-5 w-5 text-green-500" />;
      case "file_added":
        return <FileText className="h-5 w-5 text-purple-500" />;
      case "file_removed":
        return <FileText className="h-5 w-5 text-red-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  const getNotificationTypeLabel = (type: string) => {
    switch (type) {
      case "status_change":
        return "Изменение статуса";
      case "comment_added":
        return "Новый комментарий";
      case "file_added":
        return "Добавлен файл";
      case "file_removed":
        return "Удален файл";
      default:
        return "Уведомление";
    }
  };

  const unreadCount = notifications?.filter(n => !n.isRead).length || 0;

  return (
    <Layout>
      <div className="container py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/contracts">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Назад
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Уведомления</h1>
              {unreadCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  {unreadCount} непрочитанных
                </p>
              )}
            </div>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              onClick={() => markAllAsReadMutation.mutate({ userInn: user?.organizationInn || "" })}
              disabled={markAllAsReadMutation.isPending}
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              Прочитать все
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : notifications?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Нет уведомлений</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {notifications?.map((notification) => (
              <Card
                key={notification.id}
                className={`transition-colors ${
                  !notification.isRead ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800" : ""
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.notificationType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {getNotificationTypeLabel(notification.notificationType)}
                        </Badge>
                        {!notification.isRead && (
                          <Badge variant="default" className="text-xs bg-blue-500">
                            Новое
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-medium">{notification.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>
                          Договор: <Link href={`/contracts`} className="text-primary hover:underline">{notification.contractNumber}</Link>
                        </span>
                        {notification.actorUserName && (
                          <span>
                            От: {notification.actorUserName}
                            {notification.actorOrganization && ` (${notification.actorOrganization})`}
                          </span>
                        )}
                        <span>
                          {format(new Date(notification.createdAt), "dd MMM yyyy, HH:mm", { locale: ru })}
                        </span>
                      </div>
                    </div>
                    {!notification.isRead && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markAsReadMutation.mutate({ notificationId: notification.id })}
                        disabled={markAsReadMutation.isPending}
                      >
                        <CheckCheck className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
