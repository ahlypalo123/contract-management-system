import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useAppAuth } from "@/contexts/AuthContext";
import { CONTRACT_TYPES } from "@shared/contracts";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ArrowLeft,
  Save,
  Send,
  Loader2,
  Building2,
  Search,
  X,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function ContractForm() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const { currentUser, isAuthenticated, isLoading: authLoading } = useAppAuth();
  
  const isEditing = !!params.id;
  const contractId = params.id ? parseInt(params.id) : null;

  // Form state
  const [contractNumber, setContractNumber] = useState("");
  const [contractDate, setContractDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [subject, setSubject] = useState("");
  const [contractType, setContractType] = useState<string>("supply");
  const [amount, setAmount] = useState("");
  const [amountNotSpecified, setAmountNotSpecified] = useState(false);
  const [vatRate, setVatRate] = useState<number>(22); // 22% or 0 (без НДС)
  const [validUntil, setValidUntil] = useState("");
  const [prolongation, setProlongation] = useState(false);
  const [counterpartyId, setCounterpartyId] = useState<number | null>(null);
  const [counterpartyInn, setCounterpartyInn] = useState("");
  const [counterpartyEmail, setCounterpartyEmail] = useState("");

  // Counterparty search
  const [innSearch, setInnSearch] = useState("");
  const [selectedCounterparty, setSelectedCounterparty] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Queries
  const { data: generatedNumber } = trpc.contracts.generateNumber.useQuery(undefined, {
    enabled: !isEditing,
  });

  const { data: existingContract, isLoading: contractLoading } = trpc.contracts.getById.useQuery(
    { id: contractId! },
    { enabled: isEditing && !!contractId }
  );

  const { data: searchResults } = trpc.counterparties.search.useQuery(
    { query: innSearch },
    { enabled: innSearch.length >= 3 }
  );

  // Mutations
  // lookupByInn is a query, we'll use it directly
  const upsertCounterpartyMutation = trpc.counterparties.upsert.useMutation();
  const createMutation = trpc.contracts.create.useMutation();
  const updateMutation = trpc.contracts.update.useMutation();
  const changeStatusMutation = trpc.contracts.changeStatus.useMutation();

  // Set generated number
  useEffect(() => {
    if (generatedNumber && !isEditing) {
      setContractNumber(generatedNumber);
    }
  }, [generatedNumber, isEditing]);

  // Load existing contract data
  useEffect(() => {
    if (existingContract) {
      const { contract, counterparty } = existingContract;
      setContractNumber(contract.contractNumber);
      setContractDate(format(new Date(contract.contractDate), "yyyy-MM-dd"));
      setSubject(contract.subject);
      setContractType(contract.contractType);
      setAmount(contract.amount || "");
      setAmountNotSpecified(contract.amountNotSpecified);
      setValidUntil(contract.validUntil ? format(new Date(contract.validUntil), "yyyy-MM-dd") : "");
      setProlongation(contract.prolongation);
      setCounterpartyId(contract.counterpartyId);
      setCounterpartyInn(contract.counterpartyInn || "");
      setCounterpartyEmail(contract.counterpartyEmail || "");
      if (counterparty) {
        setSelectedCounterparty(counterparty);
        setInnSearch(counterparty.inn);
      }
    }
  }, [existingContract]);

  // Auth check
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

  if (isEditing && contractLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  const handleInnLookup = async () => {
    if (innSearch.length < 10) {
      toast.error("ИНН должен содержать минимум 10 цифр");
      return;
    }

    setIsSearching(true);
    try {
      // Use fetch to call the API directly since lookupByInn is a query
      const response = await fetch(`/api/trpc/counterparties.lookupByInn?input=${encodeURIComponent(JSON.stringify({ inn: innSearch }))}`);
      const json = await response.json();
      const result = json.result?.data;
      
      if (result?.found && result?.data) {
        // Upsert counterparty to get ID
        const counterpartyResult = await upsertCounterpartyMutation.mutateAsync({
          inn: result.data.inn,
          name: result.data.name,
          shortName: result.data.shortName,
          address: result.data.address,
          directorName: result.data.directorName,
        });
        
        setSelectedCounterparty({ ...result.data, id: counterpartyResult.id });
        setCounterpartyId(counterpartyResult.id);
        setCounterpartyInn(result.data.inn);
        toast.success("Контрагент найден");
      } else {
        toast.error("Контрагент не найден");
      }
    } catch (error) {
      toast.error("Ошибка поиска контрагента");
    } finally {
      setIsSearching(false);
    }
  };

  const selectCounterparty = async (counterparty: any) => {
    // If counterparty has no ID, create it first
    if (!counterparty.id) {
      try {
        const result = await upsertCounterpartyMutation.mutateAsync({
          inn: counterparty.inn,
          name: counterparty.name,
          shortName: counterparty.shortName,
          address: counterparty.address,
          directorName: counterparty.directorName,
        });
        setSelectedCounterparty({ ...counterparty, id: result.id });
        setCounterpartyId(result.id);
      } catch (error) {
        toast.error("Ошибка сохранения контрагента");
        return;
      }
    } else {
      setSelectedCounterparty(counterparty);
      setCounterpartyId(counterparty.id);
    }
    setCounterpartyInn(counterparty.inn);
    setInnSearch(counterparty.inn);
  };

  const clearCounterparty = () => {
    setSelectedCounterparty(null);
    setCounterpartyId(null);
    setCounterpartyInn("");
    setInnSearch("");
  };

  const calculateVat = () => {
    if (!amount || amountNotSpecified || vatRate === 0) return null;
    const amountNum = parseFloat(amount);
    return ((amountNum * vatRate) / (100 + vatRate)).toFixed(2);
  };

  const validateForm = (): string | null => {
    if (!subject.trim()) return "Укажите предмет договора";
    if (!counterpartyId) return "Выберите контрагента";
    if (!contractDate) return "Укажите дату договора";
    return null;
  };

  const handleSaveDraft = async () => {
    const error = validateForm();
    if (error) {
      toast.error(error);
      return;
    }

    try {
      if (isEditing && contractId) {
        await updateMutation.mutateAsync({
          id: contractId,
          subject,
          contractType: contractType as any,
          amount: amountNotSpecified ? undefined : amount,
          amountNotSpecified,
          vatRate,
          validUntil: validUntil || undefined,
          prolongation,
          counterpartyId: counterpartyId!,
          counterpartyInn: counterpartyInn || undefined,
          counterpartyEmail: counterpartyEmail || undefined,
        });
        toast.success("Договор обновлен");
      } else {
        const result = await createMutation.mutateAsync({
          contractNumber,
          contractDate,
          subject,
          contractType: contractType as any,
          amount: amountNotSpecified ? undefined : amount,
          amountNotSpecified,
          vatRate,
          validUntil: validUntil || undefined,
          prolongation,
          counterpartyId: counterpartyId!,
          counterpartyInn: counterpartyInn || undefined,
          counterpartyEmail: counterpartyEmail || undefined,
          customerInn: currentUser?.organizationInn || "",
          customerName: currentUser?.organization || "",
          createdByUserId: currentUser?.id,
          createdByUserName: currentUser?.displayName,
          createdByOrganization: currentUser?.organization,
        });
        toast.success(`Договор ${result.contractNumber} создан`);
      }
      setLocation("/contracts");
    } catch (error: any) {
      toast.error(error.message || "Ошибка сохранения");
    }
  };

  const handleSendForApproval = async () => {
    if (!counterpartyEmail) {
      toast.error("Укажите email для уведомлений");
      return;
    }

    const error = validateForm();
    if (error) {
      toast.error(error);
      return;
    }

    try {
      let targetContractId = contractId;

      if (!isEditing) {
        const result = await createMutation.mutateAsync({
          contractNumber,
          contractDate,
          subject,
          contractType: contractType as any,
          amount: amountNotSpecified ? undefined : amount,
          amountNotSpecified,
          vatRate,
          validUntil: validUntil || undefined,
          prolongation,
          counterpartyId: counterpartyId!,
          counterpartyInn: counterpartyInn || undefined,
          counterpartyEmail,
          customerInn: currentUser?.organizationInn || "",
          customerName: currentUser?.organization || "",
          createdByUserId: currentUser?.id,
          createdByUserName: currentUser?.displayName,
          createdByOrganization: currentUser?.organization,
        });
        targetContractId = result.id;
      }

      await changeStatusMutation.mutateAsync({
        id: targetContractId!,
        newStatus: "pending_customer",
        changedByUserId: currentUser?.id,
        changedByUserName: currentUser?.displayName,
        changedByOrganization: currentUser?.organization,
        userInn: currentUser?.organizationInn || "",
        canApprove: currentUser?.canApprove || false,
      });

      toast.success("Договор отправлен на согласование");
      setLocation("/contracts");
    } catch (error: any) {
      toast.error(error.message || "Ошибка отправки");
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending || changeStatusMutation.isPending;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/contracts")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isEditing ? "Редактирование договора" : "Новый договор"}
            </h1>
            <p className="text-muted-foreground">
              {isEditing ? `Договор ${contractNumber}` : "Заполните данные договора"}
            </p>
          </div>
        </div>

        {/* Customer Info */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-primary" />
              <div>
                <p className="font-medium">Заказчик: {currentUser?.organization}</p>
                <p className="text-sm text-muted-foreground">ИНН: {currentUser?.organizationInn}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Основные данные</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contractNumber">№ договора</Label>
                  <Input
                    id="contractNumber"
                    value={contractNumber}
                    onChange={(e) => setContractNumber(e.target.value)}
                    placeholder="ДП-2026-001"
                    disabled={isEditing}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Формат: ДП-ГГГГ-NNN
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contractDate">Дата договора</Label>
                  <Input
                    id="contractDate"
                    type="date"
                    value={contractDate}
                    onChange={(e) => setContractDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Предмет договора</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Поставка оборудования, оказание услуг..."
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Тип договора</Label>
                  <Select value={contractType} onValueChange={setContractType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CONTRACT_TYPES).map(([key, { label }]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="validUntil">Срок действия до</Label>
                  <Input
                    id="validUntil"
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="prolongation"
                  checked={prolongation}
                  onCheckedChange={(checked) => setProlongation(checked as boolean)}
                />
                <Label htmlFor="prolongation" className="text-sm font-normal cursor-pointer">
                  Автоматическая пролонгация
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Counterparty */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Контрагент (Исполнитель)</CardTitle>
              <CardDescription>
                Введите ИНН для поиска организации
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedCounterparty ? (
                <div className="p-4 rounded-lg border bg-accent/50">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <Building2 className="w-10 h-10 p-2 rounded-lg bg-primary/10 text-primary shrink-0" />
                      <div>
                        <p className="font-medium">{selectedCounterparty.name}</p>
                        <p className="text-sm text-muted-foreground">
                          ИНН: {selectedCounterparty.inn}
                        </p>
                        {selectedCounterparty.address && (
                          <p className="text-sm text-muted-foreground">
                            {selectedCounterparty.address}
                          </p>
                        )}
                        {selectedCounterparty.directorName && (
                          <p className="text-sm text-muted-foreground">
                            Руководитель: {selectedCounterparty.directorName}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={clearCounterparty}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Введите ИНН (10 или 12 цифр)"
                      value={innSearch}
                      onChange={(e) => setInnSearch(e.target.value.replace(/\D/g, ""))}
                      maxLength={12}
                      className="font-mono"
                    />
                    <Button
                      onClick={handleInnLookup}
                      disabled={innSearch.length < 10 || isSearching}
                    >
                      {isSearching ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                    </Button>
                  </div>

                  {/* Search results dropdown */}
                  {searchResults && searchResults.length > 0 && !selectedCounterparty && (
                    <div className="border rounded-lg divide-y max-h-60 overflow-auto">
                      {searchResults.map((cp: any, index: number) => (
                        <button
                          key={cp.inn + index}
                          onClick={() => selectCounterparty(cp)}
                          className="w-full p-3 text-left hover:bg-accent transition-colors"
                        >
                          <p className="font-medium">{cp.name}</p>
                          <p className="text-sm text-muted-foreground">
                            ИНН: {cp.inn}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="counterpartyEmail">Email для уведомлений</Label>
                <Input
                  id="counterpartyEmail"
                  type="email"
                  value={counterpartyEmail}
                  onChange={(e) => setCounterpartyEmail(e.target.value)}
                  placeholder="email@company.ru"
                />
              </div>
            </CardContent>
          </Card>

          {/* Financial */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Финансовые условия</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="amountNotSpecified"
                  checked={amountNotSpecified}
                  onCheckedChange={(checked) => setAmountNotSpecified(checked as boolean)}
                />
                <Label htmlFor="amountNotSpecified" className="text-sm font-normal cursor-pointer">
                  Сумма не указана (определяется дополнительным соглашением)
                </Label>
              </div>

              {!amountNotSpecified && (
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="amount">Сумма договора (с НДС)</Label>
                      <div className="relative">
                        <Input
                          id="amount"
                          type="number"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="0.00"
                          className="pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          ₽
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>НДС</Label>
                      <Select value={vatRate.toString()} onValueChange={(v) => setVatRate(parseInt(v))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="22">22%</SelectItem>
                          <SelectItem value="0">Без НДС</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {vatRate > 0 && amount && (
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Сумма НДС ({vatRate}%):</span>
                        <span className="font-medium">{calculateVat()} ₽</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => setLocation("/contracts")}
              disabled={isSubmitting}
            >
              Отмена
            </Button>
            <Button
              variant="secondary"
              onClick={handleSaveDraft}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Сохранить черновик
            </Button>
            <Button
              onClick={handleSendForApproval}
              disabled={isSubmitting || !counterpartyEmail}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Отправить на согласование
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
