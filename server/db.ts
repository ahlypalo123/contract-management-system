import { eq, desc, and, gte, lte, sql, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, 
  contracts, InsertContract, Contract,
  counterparties, InsertCounterparty, Counterparty,
  contractFiles, InsertContractFile, ContractFile,
  contractStatusHistory, InsertContractStatusHistory,
  contractHistory, InsertContractHistory, ContractHistory,
  emailNotifications, InsertEmailNotification,
  predefinedUsers, InsertPredefinedUser, PredefinedUser,
  contractNumberSequence
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============ USER FUNCTIONS ============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod", "organizationInn", "organizationName"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }
    if (user.canApprove !== undefined) {
      values.canApprove = user.canApprove;
      updateSet.canApprove = user.canApprove;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ PREDEFINED USERS ============

export async function getPredefinedUserByLogin(login: string): Promise<PredefinedUser | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(predefinedUsers).where(eq(predefinedUsers.login, login)).limit(1);
  return result[0];
}

export async function getAllPredefinedUsers(): Promise<PredefinedUser[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(predefinedUsers);
}

export async function createPredefinedUser(user: InsertPredefinedUser): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(predefinedUsers).values(user).onDuplicateKeyUpdate({
    set: { 
      displayName: user.displayName, 
      organization: user.organization,
      organizationInn: user.organizationInn,
      canApprove: user.canApprove,
    }
  });
}

// ============ COUNTERPARTIES ============

export async function getCounterpartyById(id: number): Promise<Counterparty | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(counterparties).where(eq(counterparties.id, id)).limit(1);
  return result[0];
}

export async function getCounterpartyByInn(inn: string): Promise<Counterparty | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(counterparties).where(eq(counterparties.inn, inn)).limit(1);
  return result[0];
}

export async function searchCounterparties(query: string): Promise<Counterparty[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(counterparties)
    .where(or(
      like(counterparties.inn, `%${query}%`),
      like(counterparties.name, `%${query}%`)
    ))
    .limit(10);
}

export async function createCounterparty(data: InsertCounterparty): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(counterparties).values(data);
  return Number(result[0].insertId);
}

export async function upsertCounterparty(data: InsertCounterparty): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getCounterpartyByInn(data.inn);
  if (existing) {
    await db.update(counterparties)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(counterparties.id, existing.id));
    return existing.id;
  }
  
  return await createCounterparty(data);
}

export async function getAllCounterparties(): Promise<Counterparty[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(counterparties).orderBy(desc(counterparties.createdAt));
}

// ============ CONTRACTS ============

export async function generateContractNumber(): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const currentYear = new Date().getFullYear();
  
  // Get or create sequence for current year
  const existing = await db.select()
    .from(contractNumberSequence)
    .where(eq(contractNumberSequence.year, currentYear))
    .limit(1);
  
  let nextNumber: number;
  
  if (existing.length === 0) {
    await db.insert(contractNumberSequence).values({ year: currentYear, lastNumber: 1 });
    nextNumber = 1;
  } else {
    nextNumber = existing[0].lastNumber + 1;
    await db.update(contractNumberSequence)
      .set({ lastNumber: nextNumber })
      .where(eq(contractNumberSequence.year, currentYear));
  }
  
  // Format: ДП-{ГГГГ}-{NNN}
  const paddedNumber = String(nextNumber).padStart(3, '0');
  return `ДП-${currentYear}-${paddedNumber}`;
}

export async function createContract(data: InsertContract): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(contracts).values(data);
  return Number(result[0].insertId);
}

export async function updateContract(id: number, data: Partial<InsertContract>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(contracts)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(contracts.id, id));
}

export async function getContractById(id: number): Promise<Contract | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(contracts).where(eq(contracts.id, id)).limit(1);
  return result[0];
}

export async function getAllContracts(): Promise<Contract[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(contracts).orderBy(desc(contracts.createdAt));
}

export async function getContractsByUserOrganization(userInn: string): Promise<Contract[]> {
  const db = await getDb();
  if (!db) return [];
  
  // User can see contracts where they are customer or counterparty
  return await db.select().from(contracts)
    .where(or(
      eq(contracts.customerInn, userInn),
      eq(contracts.counterpartyInn, userInn)
    ))
    .orderBy(desc(contracts.createdAt));
}

export async function getContractsByStatus(status: string): Promise<Contract[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(contracts)
    .where(eq(contracts.status, status as any))
    .orderBy(desc(contracts.createdAt));
}

export async function getContractsWithCounterparties(userInn?: string) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select({
    contract: contracts,
    counterparty: counterparties
  })
  .from(contracts)
  .leftJoin(counterparties, eq(contracts.counterpartyId, counterparties.id));
  
  if (userInn) {
    query = query.where(or(
      eq(contracts.customerInn, userInn),
      eq(contracts.counterpartyInn, userInn)
    )) as any;
  }
  
  const result = await query.orderBy(desc(contracts.createdAt));
  return result;
}

export async function getUrgentContracts(hoursAhead: number = 48, userInn?: string): Promise<Contract[]> {
  const db = await getDb();
  if (!db) return [];
  
  const now = new Date();
  const deadline = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
  
  let whereConditions = and(
    lte(contracts.validUntil, deadline),
    gte(contracts.validUntil, now)
  );
  
  if (userInn) {
    whereConditions = and(
      whereConditions,
      or(
        eq(contracts.customerInn, userInn),
        eq(contracts.counterpartyInn, userInn)
      )
    );
  }
  
  return await db.select().from(contracts)
    .where(whereConditions)
    .orderBy(contracts.validUntil);
}

export async function getContractStats(userInn?: string) {
  const db = await getDb();
  if (!db) return { byStatus: [], total: 0 };
  
  let allContracts: Contract[];
  
  if (userInn) {
    allContracts = await db.select().from(contracts)
      .where(or(
        eq(contracts.customerInn, userInn),
        eq(contracts.counterpartyInn, userInn)
      ));
  } else {
    allContracts = await db.select().from(contracts);
  }
  
  const byStatus = allContracts.reduce((acc, contract) => {
    const status = contract.status;
    const existing = acc.find(s => s.status === status);
    if (existing) {
      existing.count++;
    } else {
      acc.push({ status, count: 1 });
    }
    return acc;
  }, [] as { status: string; count: number }[]);
  
  return { byStatus, total: allContracts.length };
}

// Check if contract has payment receipt
export async function hasPaymentReceipt(contractId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const files = await db.select().from(contractFiles)
    .where(and(
      eq(contractFiles.contractId, contractId),
      eq(contractFiles.fileType, "payment_receipt"),
      eq(contractFiles.isDeleted, false)
    ))
    .limit(1);
  
  return files.length > 0;
}

// ============ CONTRACT STATUS HISTORY (legacy) ============

export async function addStatusHistory(data: InsertContractStatusHistory): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(contractStatusHistory).values(data);
}

export async function getContractStatusHistory(contractId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(contractStatusHistory)
    .where(eq(contractStatusHistory.contractId, contractId))
    .orderBy(desc(contractStatusHistory.createdAt));
}

// ============ CONTRACT HISTORY (unified) ============

export async function addContractHistory(data: InsertContractHistory): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(contractHistory).values(data);
}

export async function getContractHistory(contractId: number): Promise<ContractHistory[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(contractHistory)
    .where(eq(contractHistory.contractId, contractId))
    .orderBy(desc(contractHistory.createdAt));
}

// ============ CONTRACT FILES ============

export async function addContractFile(data: InsertContractFile): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(contractFiles).values(data);
  return Number(result[0].insertId);
}

export async function getContractFiles(contractId: number): Promise<ContractFile[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(contractFiles)
    .where(and(
      eq(contractFiles.contractId, contractId),
      eq(contractFiles.isDeleted, false)
    ))
    .orderBy(desc(contractFiles.createdAt));
}

export async function deleteContractFile(fileId: number, deletedByUserId?: number, deletedByUserName?: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  // Soft delete
  await db.update(contractFiles)
    .set({ 
      isDeleted: true, 
      deletedAt: new Date(),
      deletedByUserId,
      deletedByUserName
    })
    .where(eq(contractFiles.id, fileId));
}

export async function getContractFileById(fileId: number): Promise<ContractFile | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(contractFiles)
    .where(eq(contractFiles.id, fileId))
    .limit(1);
  
  return result[0];
}

// ============ EMAIL NOTIFICATIONS ============

export async function logEmailNotification(data: InsertEmailNotification): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(emailNotifications).values(data);
}

export async function getEmailNotifications(contractId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(emailNotifications)
    .where(eq(emailNotifications.contractId, contractId))
    .orderBy(desc(emailNotifications.createdAt));
}


// ============ USER NOTIFICATIONS ============

import { notifications, InsertNotification, Notification } from "../drizzle/schema";

export async function createNotification(data: InsertNotification): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(notifications).values(data);
}

export async function createNotificationsForContract(
  contractId: number,
  contractNumber: string,
  notificationType: "status_change" | "comment_added" | "file_added" | "file_removed",
  title: string,
  message: string,
  actorUserId: number | undefined,
  actorUserName: string | undefined,
  actorOrganization: string | undefined,
  excludeUserInn?: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  // Get contract to find customer and counterparty
  const contract = await getContractById(contractId);
  if (!contract) return;
  
  // Get all users who should be notified (customer and counterparty organizations)
  const usersToNotify = await db.select().from(users)
    .where(or(
      eq(users.organizationInn, contract.customerInn),
      eq(users.organizationInn, contract.counterpartyInn || "")
    ));
  
  // Create notifications for each user except the actor
  for (const user of usersToNotify) {
    if (excludeUserInn && user.organizationInn === excludeUserInn) continue;
    if (!user.organizationInn) continue;
    
    await db.insert(notifications).values({
      recipientUserId: user.id,
      recipientOrganizationInn: user.organizationInn,
      contractId,
      contractNumber,
      notificationType,
      title,
      message,
      actorUserId,
      actorUserName,
      actorOrganization,
      isRead: false,
    });
  }
}

export async function getNotificationsForUser(userInn: string): Promise<Notification[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(notifications)
    .where(eq(notifications.recipientOrganizationInn, userInn))
    .orderBy(desc(notifications.createdAt));
}

export async function getUnreadNotificationCount(userInn: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(
      eq(notifications.recipientOrganizationInn, userInn),
      eq(notifications.isRead, false)
    ));
  
  return result[0]?.count || 0;
}

export async function markNotificationAsRead(notificationId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(eq(notifications.id, notificationId));
}

export async function markAllNotificationsAsRead(userInn: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(
      eq(notifications.recipientOrganizationInn, userInn),
      eq(notifications.isRead, false)
    ));
}
