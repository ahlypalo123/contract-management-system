import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { trpc } from "@/lib/trpc";
import { useAppAuth } from "@/contexts/AuthContext";
import { CONTRACT_STATUSES, ContractStatus } from "@shared/contracts";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Plus,
  Search,
  Calendar,
  Building2,
  FileText,
  ChevronRight,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ContractModal } from "@/components/ContractModal";

export default function Contracts() {
  const [, setLocation] = useLocation();
  const { currentUser, isAuthenticated, isLoading: authLoading } = useAppAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [groupByStatus, setGroupByStatus] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState<number | null>(null);

  const { data: contractsData, isLoading, refetch } = trpc.contracts.list.useQuery();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const contracts = contractsData || [];

  // Filter contracts by search query
  const filteredContracts = contracts.filter((item) => {
    const contract = item.contract;
    const counterparty = item.counterparty;
    const query = searchQuery.toLowerCase();
    
    return (
      contract.contractNumber.toLowerCase().includes(query) ||
      contract.subject.toLowerCase().includes(query) ||
      (counterparty?.name?.toLowerCase().includes(query) ?? false) ||
      (counterparty?.inn?.includes(query) ?? false)
    );
  });

  // Group contracts by status
  const groupedContracts = groupByStatus
    ? Object.entries(CONTRACT_STATUSES).reduce((acc, [status]) => {
        const statusContracts = filteredContracts.filter(
          (item) => item.contract.status === status
        );
        if (statusContracts.length > 0) {
          acc[status as ContractStatus] = statusContracts;
        }
        return acc;
      }, {} as Record<ContractStatus, typeof filteredContracts>)
    : null;

  const formatDate = (date: Date | string | null) => {
    if (!date) return "—";
    return format(new Date(date), "dd.MM.yyyy", { locale: ru });
  };

  const formatAmount = (amount: string | null, notSpecified: boolean) => {
    if (notSpecified) return "Не указана";
    if (!amount) return "—";
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      minimumFractionDigits: 0,
    }).format(parseFloat(amount));
  };

  const renderContractRow = (item: typeof contracts[0], index: number) => {
    const { contract, counterparty } = item;
    
    return (
      <tr
        key={contract.id}
        onClick={() => setSelectedContractId(contract.id)}
        className={cn(
          "group cursor-pointer transition-colors hover:bg-accent/50",
          "animate-fade-in",
          index % 2 === 0 ? "bg-white" : "bg-slate-50/50"
        )}
        style={{ animationDelay: `${index * 0.03}s` }}
      >
        <td className="px-4 py-3 font-medium text-primary">
          {contract.contractNumber}
        </td>
        <td className="px-4 py-3 text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {formatDate(contract.contractDate)}
          </div>
        </td>
        <td className="px-4 py-3 max-w-xs">
          <p className="truncate" title={contract.subject}>
            {contract.subject}
          </p>
        </td>
        <td className="px-4 py-3">
          <StatusBadge status={contract.status as ContractStatus} size="sm" />
        </td>
        <td className="px-4 py-3 font-medium">
          {formatAmount(contract.amount, contract.amountNotSpecified)}
        </td>
        <td className="px-4 py-3 text-muted-foreground">
          {formatDate(contract.validUntil)}
        </td>
        <td className="px-4 py-3 text-center">
          {contract.prolongation ? (
            <span className="text-green-600">✓</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
        <td className="px-4 py-3">
          {counterparty && (
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="truncate text-sm" title={counterparty.name}>
                  {counterparty.shortName || counterparty.name}
                </p>
                <p className="text-xs text-muted-foreground">{counterparty.inn}</p>
              </div>
            </div>
          )}
        </td>
        <td className="px-4 py-3 text-center">
          <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity inline-block" />
        </td>
      </tr>
    );
  };

  const renderTable = (contractsList: typeof filteredContracts) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-slate-50/80">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              № договора
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Дата
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Предмет договора
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Статус
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Сумма
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Срок действия
            </th>
            <th className="px-4 py-3 text-center font-medium text-muted-foreground">
              Пролонгация
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Контрагент
            </th>
            <th className="px-4 py-3 w-10"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {contractsList.map((item, index) => renderContractRow(item, index))}
        </tbody>
      </table>
    </div>
  );

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Договоры</h1>
            <p className="text-muted-foreground mt-1">
              Управление договорами организации
            </p>
          </div>
          <Link href="/contracts/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Создать договор
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по номеру, предмету, контрагенту..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="group-status"
                checked={groupByStatus}
                onCheckedChange={setGroupByStatus}
              />
              <Label htmlFor="group-status" className="text-sm cursor-pointer">
                Группировать по статусу
              </Label>
            </div>
            <Button variant="outline" size="icon" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredContracts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-1">Договоры не найдены</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery
                ? "Попробуйте изменить параметры поиска"
                : "Создайте первый договор для начала работы"}
            </p>
            {!searchQuery && (
              <Link href="/contracts/new">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Создать договор
                </Button>
              </Link>
            )}
          </div>
        ) : groupByStatus && groupedContracts ? (
          <div className="space-y-6">
            {Object.entries(groupedContracts).map(([status, statusContracts]) => (
              <div
                key={status}
                className="bg-white rounded-xl border elegant-shadow overflow-hidden"
              >
                <div className="px-4 py-3 bg-slate-50/80 border-b flex items-center gap-2">
                  <span className="text-lg">
                    {CONTRACT_STATUSES[status as ContractStatus].icon}
                  </span>
                  <h2 className="font-semibold">
                    {CONTRACT_STATUSES[status as ContractStatus].label}
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    ({statusContracts.length})
                  </span>
                </div>
                {renderTable(statusContracts)}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border elegant-shadow overflow-hidden">
            {renderTable(filteredContracts)}
          </div>
        )}
      </div>

      {/* Contract Modal */}
      {selectedContractId && (
        <ContractModal
          contractId={selectedContractId}
          open={!!selectedContractId}
          onClose={() => setSelectedContractId(null)}
          onStatusChange={() => refetch()}
        />
      )}
    </Layout>
  );
}
