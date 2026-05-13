import { useState } from "react";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { trpc } from "@/lib/trpc";
import { useAppAuth } from "@/contexts/AuthContext";
import { 
  CONTRACT_STATUSES, 
  STATUS_TRANSITIONS, 
  ContractStatus, 
  FILE_TYPES, 
  FileType,
  CUSTOMER_CHANGEABLE_STATUSES,
  CONTRACTOR_CHANGEABLE_STATUSES,
  REQUIRES_PAYMENT_RECEIPT,
} from "@shared/contracts";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";
import {
  Calendar,
  Building2,
  FileText,
  History,
  Upload,
  Download,
  Trash2,
  CheckCircle,
  XCircle,
  ArrowRight,
  Loader2,
  Edit,
  Clock,
  MessageSquare,
  Send,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ContractModalProps {
  contractId: number;
  open: boolean;
  onClose: () => void;
  onStatusChange?: () => void;
}

export function ContractModal({
  contractId,
  open,
  onClose,
  onStatusChange,
}: ContractModalProps) {
  const [, setLocation] = useLocation();
  const { currentUser } = useAppAuth();
  const [comment, setComment] = useState("");
  const [newComment, setNewComment] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const { data, isLoading, refetch } = trpc.contracts.getById.useQuery(
    { id: contractId },
    { enabled: open }
  );

  const changeStatusMutation = trpc.contracts.changeStatus.useMutation({
    onSuccess: () => {
      toast.success("Статус договора изменен");
      refetch();
      onStatusChange?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const addCommentMutation = trpc.contracts.addComment.useMutation({
    onSuccess: () => {
      toast.success("Комментарий добавлен");
      setNewComment("");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const uploadFileMutation = trpc.files.upload.useMutation({
    onSuccess: () => {
      toast.success("Файл загружен");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteFileMutation = trpc.files.delete.useMutation({
    onSuccess: () => {
      toast.success("Файл удален");
      refetch();
    },
  });

  if (isLoading || !data) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const { contract, counterparty, files, history } = data;
  const currentStatus = contract.status as ContractStatus;
  const allowedTransitions = STATUS_TRANSITIONS[currentStatus] || [];

  // Check if user can change status based on their organization
  const userInn = currentUser?.organizationInn || "";
  const isCustomer = contract.customerInn === userInn;
  const isContractor = contract.counterpartyInn === userInn;
  const canApprove = currentUser?.canApprove || false;

  // Determine which statuses user can change to
  const canChangeStatus = (newStatus: ContractStatus): boolean => {
    // Check if transition is allowed
    if (!allowedTransitions.includes(newStatus)) return false;

    // Check if user has approval rights for approval statuses
    if (newStatus === "pending_contractor" || newStatus === "pending_customer") {
      if (!canApprove) return false;
    }

    // Check if current status can be changed by customer or contractor
    if (CUSTOMER_CHANGEABLE_STATUSES.includes(currentStatus)) {
      return isCustomer;
    }
    if (CONTRACTOR_CHANGEABLE_STATUSES.includes(currentStatus)) {
      return isContractor;
    }

    return false;
  };

  // Check if payment receipt is required
  const needsPaymentReceipt = REQUIRES_PAYMENT_RECEIPT.includes(currentStatus);
  const hasPaymentReceipt = files.some(f => f.fileType === "payment_receipt" && !f.isDeleted);

  const formatDate = (date: Date | string | null) => {
    if (!date) return "—";
    return format(new Date(date), "dd.MM.yyyy", { locale: ru });
  };

  const formatDateTime = (date: Date | string | null) => {
    if (!date) return "—";
    return format(new Date(date), "dd.MM.yyyy HH:mm", { locale: ru });
  };

  const formatAmount = (amount: string | null, notSpecified: boolean) => {
    if (notSpecified) return "Сумма не указана";
    if (!amount) return "—";
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      minimumFractionDigits: 0,
    }).format(parseFloat(amount));
  };

  const handleStatusChange = (newStatus: ContractStatus) => {
    // Check for payment receipt requirement
    if (newStatus === "paid" && !hasPaymentReceipt) {
      toast.error("Для перевода в статус 'Оплачено' необходимо прикрепить чек об оплате");
      return;
    }

    changeStatusMutation.mutate({
      id: contractId,
      newStatus,
      comment: comment || undefined,
      changedByUserId: currentUser?.id,
      changedByUserName: currentUser?.displayName,
      changedByOrganization: currentUser?.organization,
      userInn: currentUser?.organizationInn || "",
      canApprove: currentUser?.canApprove || false,
    });
    setComment("");
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    
    addCommentMutation.mutate({
      contractId,
      comment: newComment.trim(),
      userId: currentUser?.id,
      userName: currentUser?.displayName || "Пользователь",
      userOrganization: currentUser?.organization,
    });
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    fileType: FileType
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Размер файла превышает 10 МБ");
      return;
    }

    setIsUploading(true);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        await uploadFileMutation.mutateAsync({
          contractId,
          fileName: file.name,
          originalName: file.name,
          fileData: base64,
          mimeType: file.type,
          fileType,
          uploadedByUserId: currentUser?.id,
          uploadedByUserName: currentUser?.displayName,
          uploadedByOrganization: currentUser?.organization,
        });
      };
      reader.readAsDataURL(file);
    } finally {
      setIsUploading(false);
    }
  };

  const canEdit = currentStatus === "draft" || currentStatus === "rejected";

  // Get event icon
  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case "status_change":
        return <History className="w-4 h-4" />;
      case "comment":
        return <MessageSquare className="w-4 h-4" />;
      case "file_added":
        return <Upload className="w-4 h-4" />;
      case "file_removed":
        return <Trash2 className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  // Get event color
  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case "status_change":
        return "bg-blue-100 text-blue-600";
      case "comment":
        return "bg-purple-100 text-purple-600";
      case "file_added":
        return "bg-green-100 text-green-600";
      case "file_removed":
        return "bg-red-100 text-red-600";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-2xl flex items-center gap-3">
                <FileText className="w-6 h-6 text-primary" />
                Договор {contract.contractNumber}
              </DialogTitle>
              <p className="text-muted-foreground mt-1">{contract.subject}</p>
            </div>
            <StatusBadge status={currentStatus} size="lg" />
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Детали</TabsTrigger>
            <TabsTrigger value="files">
              Файлы ({files.filter(f => !f.isDeleted).length})
            </TabsTrigger>
            <TabsTrigger value="history">
              История ({history.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6 mt-4">
            {/* Contract Info */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Дата договора</Label>
                  <p className="font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    {formatDate(contract.contractDate)}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Срок действия</Label>
                  <p className="font-medium">
                    {contract.validUntil ? formatDate(contract.validUntil) : "Не указан"}
                    {contract.prolongation && (
                      <span className="ml-2 text-xs text-green-600">(с пролонгацией)</span>
                    )}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Сумма</Label>
                  <p className="font-medium text-lg">
                    {formatAmount(contract.amount, contract.amountNotSpecified)}
                  </p>
                  {contract.vatAmount && (
                    <p className="text-sm text-muted-foreground">
                      в т.ч. НДС 22%: {formatAmount(contract.vatAmount, false)}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Заказчик</Label>
                  <p className="font-medium flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    {contract.customerName || "Не указан"}
                  </p>
                  {contract.customerInn && (
                    <p className="text-sm text-muted-foreground">ИНН: {contract.customerInn}</p>
                  )}
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Контрагент (Исполнитель)</Label>
                  {counterparty ? (
                    <>
                      <p className="font-medium flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        {counterparty.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        ИНН: {counterparty.inn}
                      </p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">Не указан</p>
                  )}
                </div>
              </div>
            </div>

            {/* Role indicator */}
            <div className="p-3 rounded-lg bg-accent/50 border">
              <p className="text-sm">
                <span className="font-medium">Ваша роль:</span>{" "}
                {isCustomer && isContractor ? (
                  <span className="text-purple-600">Заказчик и Исполнитель</span>
                ) : isCustomer ? (
                  <span className="text-blue-600">Заказчик</span>
                ) : isContractor ? (
                  <span className="text-green-600">Исполнитель</span>
                ) : (
                  <span className="text-muted-foreground">Наблюдатель</span>
                )}
                {canApprove && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                    Право согласования
                  </span>
                )}
              </p>
            </div>

            {/* Status Actions */}
            {allowedTransitions.length > 0 && (
              <div className="space-y-4 p-4 rounded-lg border bg-accent/30">
                <Label className="font-medium">Изменить статус</Label>
                
                {/* Payment receipt warning */}
                {currentStatus === "awaiting_payment" && !hasPaymentReceipt && (
                  <div className="flex items-center gap-2 p-2 rounded bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    Для перевода в статус "Оплачено" необходимо прикрепить чек об оплате
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {allowedTransitions.map((status) => {
                    const canChange = canChangeStatus(status);
                    const statusInfo = CONTRACT_STATUSES[status];
                    const needsReceipt = status === "paid" && !hasPaymentReceipt;
                    
                    return (
                      <Button
                        key={status}
                        variant={canChange && !needsReceipt ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleStatusChange(status)}
                        disabled={changeStatusMutation.isPending || !canChange || needsReceipt}
                        className={cn(
                          !canChange && "opacity-50 cursor-not-allowed"
                        )}
                        title={
                          !canChange 
                            ? "У вас нет прав для этого действия" 
                            : needsReceipt 
                              ? "Прикрепите чек об оплате"
                              : undefined
                        }
                      >
                        {statusInfo.icon} {statusInfo.label}
                      </Button>
                    );
                  })}
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Комментарий к смене статуса</Label>
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Добавьте комментарий (необязательно)"
                    className="resize-none"
                    rows={2}
                  />
                </div>
              </div>
            )}

            {/* Edit button */}
            {canEdit && isCustomer && (
              <Button
                variant="outline"
                onClick={() => {
                  onClose();
                  setLocation(`/contracts/${contractId}/edit`);
                }}
              >
                <Edit className="w-4 h-4 mr-2" />
                Редактировать
              </Button>
            )}
          </TabsContent>

          <TabsContent value="files" className="space-y-4 mt-4">
            {/* Upload section */}
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(FILE_TYPES).map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label className="text-sm">{label}</Label>
                  <div className="relative">
                    <Input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleFileUpload(e, key as FileType)}
                      disabled={isUploading}
                      className="cursor-pointer"
                    />
                    {isUploading && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Files list */}
            <div className="space-y-2">
              <Label className="font-medium">Прикрепленные файлы</Label>
              {files.filter(f => !f.isDeleted).length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">
                  Файлы не загружены
                </p>
              ) : (
                <div className="space-y-2">
                  {files.filter(f => !f.isDeleted).map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-white"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-primary" />
                        <div>
                          <p className="font-medium text-sm">{file.originalName}</p>
                          <p className="text-xs text-muted-foreground">
                            {FILE_TYPES[file.fileType as FileType]} •{" "}
                            {(file.fileSize / 1024).toFixed(1)} КБ •{" "}
                            {formatDateTime(file.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                        >
                          <a href={file.fileUrl} target="_blank" rel="noopener noreferrer">
                            <Download className="w-4 h-4" />
                          </a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteFileMutation.mutate({ 
                            fileId: file.id,
                            deletedByUserId: currentUser?.id,
                            deletedByUserName: currentUser?.displayName,
                            deletedByOrganization: currentUser?.organization,
                          })}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-4 mt-4">
            {/* Add comment section */}
            <div className="p-4 rounded-lg border bg-accent/30 space-y-3">
              <Label className="font-medium">Добавить комментарий</Label>
              <div className="flex gap-2">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Напишите комментарий..."
                  className="resize-none flex-1"
                  rows={2}
                />
                <Button
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || addCommentMutation.isPending}
                  className="self-end"
                >
                  {addCommentMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* History list */}
            {history.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">
                История пуста
              </p>
            ) : (
              <div className="space-y-3">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-3 p-3 rounded-lg border bg-white"
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                      getEventColor(item.eventType)
                    )}>
                      {getEventIcon(item.eventType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      {item.eventType === "status_change" && item.newStatus && (
                        <div className="flex items-center gap-2 flex-wrap">
                          {item.previousStatus && (
                            <>
                              <StatusBadge
                                status={item.previousStatus as ContractStatus}
                                size="sm"
                                showIcon={false}
                              />
                              <ArrowRight className="w-4 h-4 text-muted-foreground" />
                            </>
                          )}
                          <StatusBadge
                            status={item.newStatus as ContractStatus}
                            size="sm"
                          />
                        </div>
                      )}
                      {item.eventType === "comment" && (
                        <p className="text-sm bg-accent/50 p-2 rounded">
                          {item.comment}
                        </p>
                      )}
                      {item.eventType === "file_added" && (
                        <p className="text-sm">
                          <span className="text-green-600">Добавлен файл:</span>{" "}
                          {item.fileName}
                        </p>
                      )}
                      {item.eventType === "file_removed" && (
                        <p className="text-sm">
                          <span className="text-red-600">Удален файл:</span>{" "}
                          {item.fileName}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {item.userName || "Система"}
                        {item.userOrganization && ` (${item.userOrganization})`}
                        {" • "}
                        {formatDateTime(item.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
