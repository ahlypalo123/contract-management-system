import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, bigint } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  // New fields for organization binding
  organizationInn: varchar("organizationInn", { length: 12 }),
  organizationName: varchar("organizationName", { length: 255 }),
  canApprove: boolean("canApprove").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Predefined users for the contract management system
 */
export const predefinedUsers = mysqlTable("predefined_users", {
  id: int("id").autoincrement().primaryKey(),
  login: varchar("login", { length: 64 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  displayName: varchar("displayName", { length: 255 }).notNull(),
  organization: varchar("organization", { length: 255 }).notNull(),
  organizationInn: varchar("organizationInn", { length: 12 }).notNull(),
  role: mysqlEnum("role", ["it_head", "director_roga", "director_hlyp"]).notNull(),
  canApprove: boolean("canApprove").default(false).notNull(),
  email: varchar("email", { length: 320 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PredefinedUser = typeof predefinedUsers.$inferSelect;
export type InsertPredefinedUser = typeof predefinedUsers.$inferInsert;

/**
 * Counterparties (контрагенты)
 */
export const counterparties = mysqlTable("counterparties", {
  id: int("id").autoincrement().primaryKey(),
  inn: varchar("inn", { length: 12 }).notNull().unique(),
  name: varchar("name", { length: 500 }).notNull(),
  shortName: varchar("shortName", { length: 255 }),
  kpp: varchar("kpp", { length: 9 }),
  ogrn: varchar("ogrn", { length: 15 }),
  address: text("address"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  directorName: varchar("directorName", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Counterparty = typeof counterparties.$inferSelect;
export type InsertCounterparty = typeof counterparties.$inferInsert;

/**
 * Contract statuses enum - updated with act_signing status
 */
export const contractStatusEnum = mysqlEnum("contractStatus", [
  "draft",                    // Черновик
  "pending_customer",         // На согласовании у заказчика
  "pending_contractor",       // На согласовании у исполнителя
  "awaiting_payment",         // Ожидает оплаты
  "paid",                     // Оплачен
  "in_progress",              // Выполняется
  "act_signing",              // Подписание акта выполненных работ
  "completed",                // Завершен
  "rejected"                  // Отклонен
]);

/**
 * Contract types enum
 */
export const contractTypeEnum = mysqlEnum("contractType", [
  "supply",    // Поставка
  "rent",      // Аренда
  "services",  // Услуги
  "work",      // Работы
  "lease",     // Лизинг
  "other"      // Прочее
]);

/**
 * Payment frequency enum - disabled for now
 */
export const paymentFrequencyEnum = mysqlEnum("paymentFrequency", [
  "none",      // Нет
  "once",      // Единовременно
  "monthly",   // Ежемесячно
  "quarterly", // Ежеквартально
  "yearly"     // Ежегодно
]);

/**
 * Contracts table
 */
export const contracts = mysqlTable("contracts", {
  id: int("id").autoincrement().primaryKey(),
  contractNumber: varchar("contractNumber", { length: 50 }).notNull().unique(),
  contractDate: timestamp("contractDate").notNull(),
  subject: text("subject").notNull(),
  contractType: contractTypeEnum.notNull(),
  status: mysqlEnum("status", [
    "draft", "pending_customer", "pending_contractor", 
    "awaiting_payment", "paid", "in_progress", "act_signing", "completed", "rejected"
  ]).default("draft").notNull(),
  
  // Amount fields - VAT fixed at 22%
  amount: decimal("amount", { precision: 15, scale: 2 }),
  amountNotSpecified: boolean("amountNotSpecified").default(false).notNull(),
  vatRate: int("vatRate").default(22),
  vatAmount: decimal("vatAmount", { precision: 15, scale: 2 }),
  
  // Dates
  validUntil: timestamp("validUntil"),
  prolongation: boolean("prolongation").default(false).notNull(),
  
  // Customer (заказчик) - organization that creates the contract
  customerInn: varchar("customerInn", { length: 12 }).notNull(),
  customerName: varchar("customerName", { length: 255 }),
  
  // Counterparty (контрагент/исполнитель)
  counterpartyId: int("counterpartyId").notNull(),
  counterpartyInn: varchar("counterpartyInn", { length: 12 }),
  counterpartyEmail: varchar("counterpartyEmail", { length: 320 }),
  
  // Payment frequency - disabled for now
  paymentFrequency: mysqlEnum("paymentFrequency", ["none", "once", "monthly", "quarterly", "yearly"]).default("none").notNull(),
  
  // Creator and responsible
  createdByUserId: int("createdByUserId"),
  responsibleUserId: int("responsibleUserId"),
  
  // Generated documents paths
  generatedContractUrl: text("generatedContractUrl"),
  generatedActUrl: text("generatedActUrl"),
  
  // Rejection comment
  rejectionComment: text("rejectionComment"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Contract = typeof contracts.$inferSelect;
export type InsertContract = typeof contracts.$inferInsert;

/**
 * Contract history - unified for status changes, files, and comments
 */
export const contractHistory = mysqlTable("contract_history", {
  id: int("id").autoincrement().primaryKey(),
  contractId: int("contractId").notNull(),
  eventType: mysqlEnum("eventType", [
    "status_change",    // Изменение статуса
    "file_added",       // Добавление файла
    "file_removed",     // Удаление файла
    "comment"           // Комментарий
  ]).notNull(),
  // For status changes
  previousStatus: varchar("previousStatus", { length: 50 }),
  newStatus: varchar("newStatus", { length: 50 }),
  // For files
  fileName: varchar("fileName", { length: 255 }),
  fileType: varchar("fileType", { length: 50 }),
  // For all events
  comment: text("comment"),
  userId: int("userId"),
  userName: varchar("userName", { length: 255 }),
  userOrganization: varchar("userOrganization", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ContractHistory = typeof contractHistory.$inferSelect;
export type InsertContractHistory = typeof contractHistory.$inferInsert;

/**
 * Contract status history - kept for backward compatibility
 */
export const contractStatusHistory = mysqlTable("contract_status_history", {
  id: int("id").autoincrement().primaryKey(),
  contractId: int("contractId").notNull(),
  previousStatus: varchar("previousStatus", { length: 50 }),
  newStatus: varchar("newStatus", { length: 50 }).notNull(),
  changedByUserId: int("changedByUserId"),
  changedByUserName: varchar("changedByUserName", { length: 255 }),
  comment: text("comment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ContractStatusHistory = typeof contractStatusHistory.$inferSelect;
export type InsertContractStatusHistory = typeof contractStatusHistory.$inferInsert;

/**
 * Contract files
 */
export const contractFiles = mysqlTable("contract_files", {
  id: int("id").autoincrement().primaryKey(),
  contractId: int("contractId").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  originalName: varchar("originalName", { length: 255 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  fileSize: bigint("fileSize", { mode: "number" }).notNull(),
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  fileType: mysqlEnum("fileType", [
    "contract",           // Сгенерированный договор
    "act",               // Акт выполненных работ
    "signed_contract",   // Подписанный договор
    "payment_receipt",   // Чек об оплате
    "additional"         // Дополнительные документы
  ]).notNull(),
  uploadedByUserId: int("uploadedByUserId"),
  uploadedByUserName: varchar("uploadedByUserName", { length: 255 }),
  isDeleted: boolean("isDeleted").default(false).notNull(),
  deletedAt: timestamp("deletedAt"),
  deletedByUserId: int("deletedByUserId"),
  deletedByUserName: varchar("deletedByUserName", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ContractFile = typeof contractFiles.$inferSelect;
export type InsertContractFile = typeof contractFiles.$inferInsert;

/**
 * Email notifications log
 */
export const emailNotifications = mysqlTable("email_notifications", {
  id: int("id").autoincrement().primaryKey(),
  contractId: int("contractId").notNull(),
  recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  body: text("body").notNull(),
  status: mysqlEnum("status", ["sent", "failed", "pending"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailNotification = typeof emailNotifications.$inferSelect;
export type InsertEmailNotification = typeof emailNotifications.$inferInsert;

/**
 * Contract number sequence
 */
export const contractNumberSequence = mysqlTable("contract_number_sequence", {
  id: int("id").autoincrement().primaryKey(),
  year: int("year").notNull().unique(),
  lastNumber: int("lastNumber").default(0).notNull(),
});

export type ContractNumberSequence = typeof contractNumberSequence.$inferSelect;


/**
 * User notifications - уведомления для пользователей
 */
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  // Recipient user info
  recipientUserId: int("recipientUserId").notNull(),
  recipientOrganizationInn: varchar("recipientOrganizationInn", { length: 12 }).notNull(),
  // Related contract
  contractId: int("contractId").notNull(),
  contractNumber: varchar("contractNumber", { length: 50 }).notNull(),
  // Notification type
  notificationType: mysqlEnum("notificationType", [
    "status_change",    // Изменение статуса
    "comment_added",    // Добавлен комментарий
    "file_added",       // Добавлен файл
    "file_removed"      // Удален файл
  ]).notNull(),
  // Content
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  // Actor info (who triggered the notification)
  actorUserId: int("actorUserId"),
  actorUserName: varchar("actorUserName", { length: 255 }),
  actorOrganization: varchar("actorOrganization", { length: 255 }),
  // Status
  isRead: boolean("isRead").default(false).notNull(),
  readAt: timestamp("readAt"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
