// Contract status definitions - updated with act_signing
export const CONTRACT_STATUSES = {
  draft: { label: "Черновик", color: "gray", icon: "📝" },
  pending_customer: { label: "На согласовании у заказчика", color: "blue", icon: "🔵" },
  pending_contractor: { label: "На согласовании у исполнителя", color: "indigo", icon: "🟣" },
  awaiting_payment: { label: "Ожидает оплаты", color: "yellow", icon: "💰" },
  paid: { label: "Оплачен", color: "green", icon: "✅" },
  in_progress: { label: "Выполняется", color: "orange", icon: "🟠" },
  act_signing: { label: "Подписание акта", color: "purple", icon: "📋" },
  completed: { label: "Завершен", color: "emerald", icon: "🟢" },
  rejected: { label: "Отклонен", color: "red", icon: "🔴" },
} as const;

export type ContractStatus = keyof typeof CONTRACT_STATUSES;

// Contract types
export const CONTRACT_TYPES = {
  supply: { label: "Поставка" },
  rent: { label: "Аренда" },
  services: { label: "Услуги" },
  work: { label: "Работы" },
  lease: { label: "Лизинг" },
  other: { label: "Прочее" },
} as const;

export type ContractType = keyof typeof CONTRACT_TYPES;

// Payment frequency - disabled for now
export const PAYMENT_FREQUENCIES = {
  none: { label: "Нет", disabled: true },
  once: { label: "Единовременно", disabled: true },
  monthly: { label: "Ежемесячно", disabled: true },
  quarterly: { label: "Ежеквартально", disabled: true },
  yearly: { label: "Ежегодно", disabled: true },
} as const;

export type PaymentFrequency = keyof typeof PAYMENT_FREQUENCIES;

// File types
export const FILE_TYPES: Record<string, string> = {
  contract: "Договор",
  act: "Акт выполненных работ",
  signed_contract: "Подписанный договор",
  payment_receipt: "Чек об оплате",
  additional: "Дополнительные документы",
};

export type FileType = "contract" | "act" | "signed_contract" | "payment_receipt" | "additional";

// History event types
export const HISTORY_EVENT_TYPES = {
  status_change: { label: "Изменение статуса", icon: "🔄" },
  file_added: { label: "Добавлен файл", icon: "📎" },
  file_removed: { label: "Удален файл", icon: "🗑️" },
  comment: { label: "Комментарий", icon: "💬" },
} as const;

export type HistoryEventType = keyof typeof HISTORY_EVENT_TYPES;

// Predefined user roles - updated with organizationInn and canApprove
export const PREDEFINED_ROLES = {
  it_head: { 
    label: "Начальник управления ИТ", 
    organization: 'ООО "Рога и копыта"',
    organizationInn: "7707083893",
    login: "it_head",
    defaultPassword: "it@rogakopita",
    canApprove: false,
  },
  director_roga: { 
    label: "Директор", 
    organization: 'ООО "Рога и копыта"',
    organizationInn: "7707083893",
    login: "director_roga",
    defaultPassword: "dir@rogakopita",
    canApprove: true,
  },
  director_hlyp: { 
    label: "Директор", 
    organization: 'Хлыпало и КО',
    organizationInn: "1111111111",
    login: "director_hlyp",
    defaultPassword: "dir@hlyp",
    canApprove: true,
  },
} as const;

// Predefined users array for UI - updated with organizationInn
export const PREDEFINED_USERS = [
  {
    id: "it_manager",
    displayName: "Начальник управления ИТ",
    organization: 'ООО "Рога и копыта"',
    organizationInn: "7707083893",
    login: "it_head",
    password: "it@rogakopita",
    icon: "user-cog",
    canApprove: false,
  },
  {
    id: "director_rk",
    displayName: "Директор",
    organization: 'ООО "Рога и копыта"',
    organizationInn: "7707083893",
    login: "director_roga",
    password: "dir@rogakopita",
    icon: "building",
    canApprove: true,
  },
  {
    id: "director_hlypalo",
    displayName: "Директор",
    organization: 'Хлыпало и КО',
    organizationInn: "1111111111",
    login: "director_hlyp",
    password: "dir@hlyp",
    icon: "building-2",
    canApprove: true,
  },
];

export type PredefinedRole = keyof typeof PREDEFINED_ROLES;

// Status workflow transitions - updated with act_signing
export const STATUS_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  draft: ["pending_customer", "rejected"],
  pending_customer: ["pending_contractor", "rejected"],
  pending_contractor: ["awaiting_payment", "rejected"],
  awaiting_payment: ["paid", "rejected"],
  paid: ["in_progress"],
  in_progress: ["act_signing"],
  act_signing: ["completed", "in_progress"], // Can complete or send back for rework
  completed: [],
  rejected: ["draft"],
};

// Statuses that can be changed by customer (заказчик)
export const CUSTOMER_CHANGEABLE_STATUSES: ContractStatus[] = [
  "draft",
  "pending_customer",
  "awaiting_payment",
  "act_signing", // Customer signs the act or sends back for rework
];

// Statuses that can be changed by contractor (контрагент/исполнитель)
export const CONTRACTOR_CHANGEABLE_STATUSES: ContractStatus[] = [
  "pending_contractor",
  "paid",
  "in_progress",
];

// Statuses that require payment receipt to transition to
export const REQUIRES_PAYMENT_RECEIPT: ContractStatus[] = ["paid"];

// Fixed VAT rate (22%)
export const FIXED_VAT_RATE = 22;

// VAT options
export const VAT_OPTIONS = [
  { value: 22, label: "22%" },
  { value: 0, label: "Без НДС" },
] as const;

// VAT_RATES for backward compatibility
export const VAT_RATES = [{ value: 22, label: "22%" }];

export type VatOption = typeof VAT_OPTIONS[number]['value'];

// Max file size (10 MB)
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Allowed file types
export const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// Known organizations for INN search
export const KNOWN_ORGANIZATIONS = [
  {
    inn: "7707083893",
    name: 'ООО "Рога и копыта"',
    shortName: "Рога и копыта",
    address: "г. Москва, ул. Примерная, д. 1",
    directorName: "Иванов И.И.",
  },
  {
    inn: "1111111111",
    name: "Хлыпало и КО",
    shortName: "Хлыпало и КО",
    address: "г. Москва, ул. Деловая, д. 10",
    directorName: "Хлыпало А.А.",
  },
];
