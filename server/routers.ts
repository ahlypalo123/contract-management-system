import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  getAllContracts,
  getContractById,
  createContract,
  updateContract,
  generateContractNumber,
  getContractsWithCounterparties,
  getContractsByStatus,
  getUrgentContracts,
  getContractStats,
  addStatusHistory,
  getContractStatusHistory,
  addContractHistory,
  getContractHistory,
  addContractFile,
  getContractFiles,
  deleteContractFile,
  getContractFileById,
  hasPaymentReceipt,
  getAllCounterparties,
  getCounterpartyById,
  getCounterpartyByInn,
  searchCounterparties,
  upsertCounterparty,
  logEmailNotification,
  getPredefinedUserByLogin,
  getAllPredefinedUsers,
  createPredefinedUser,
  createNotificationsForContract,
  getNotificationsForUser,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "./db";
import { storagePut } from "./storage";
import { 
  CONTRACT_STATUSES, 
  STATUS_TRANSITIONS, 
  ContractStatus,
  CUSTOMER_CHANGEABLE_STATUSES,
  CONTRACTOR_CHANGEABLE_STATUSES,
  REQUIRES_PAYMENT_RECEIPT,
  FIXED_VAT_RATE,
  KNOWN_ORGANIZATIONS
} from "@shared/contracts";
import { nanoid } from "nanoid";
import { generateContractHtml, generateActHtml } from "./pdfGenerator";

type OptionalDecimalInput = string | null | undefined;

export function normalizeOptionalDecimal(value: OptionalDecimalInput): string | null {
  if (value == null) return null;

  const trimmedValue = value.trim();
  return trimmedValue === "" ? null : trimmedValue;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function calculateVatAmount(amount: string | null, amountNotSpecified: boolean | undefined, vatRate: number): string | null {
  if (!amount || amountNotSpecified || vatRate <= 0) {
    return null;
  }

  return ((parseFloat(amount) * vatRate) / (100 + vatRate)).toFixed(2);
}

// ============ CONTRACTS ROUTER ============
const contractsRouter = router({
  list: publicProcedure
    .input(z.object({ userInn: z.string().optional() }).optional())
    .query(async ({ input }) => {
      return await getContractsWithCounterparties(input?.userInn);
    }),

  listByStatus: publicProcedure
    .input(z.object({ status: z.string(), userInn: z.string().optional() }))
    .query(async ({ input }) => {
      return await getContractsByStatus(input.status);
    }),

  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const contract = await getContractById(input.id);
      if (!contract) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Договор не найден" });
      }
      const counterparty = contract.counterpartyId 
        ? await getCounterpartyById(contract.counterpartyId) 
        : null;
      const files = await getContractFiles(input.id);
      const history = await getContractHistory(input.id);
      const legacyHistory = await getContractStatusHistory(input.id);
      return { contract, counterparty, files, history, legacyHistory };
    }),

  generateNumber: publicProcedure.query(async () => {
    return await generateContractNumber();
  }),

  create: publicProcedure
    .input(z.object({
      contractNumber: z.string().optional(),
      contractDate: z.string(),
      subject: z.string().min(1, "Укажите предмет договора"),
      contractType: z.enum(["supply", "rent", "services", "work", "lease", "other"]),
      amount: z.string().optional(),
      amountNotSpecified: z.boolean().default(false),
      vatRate: z.number().default(22), // 22 or 0 (без НДС)
      validUntil: z.string().optional(),
      prolongation: z.boolean().default(false),
      counterpartyId: z.number(),
      counterpartyInn: z.string().optional(),
      counterpartyEmail: z.string().email().optional(),
      customerInn: z.string(),
      customerName: z.string().optional(),
      createdByUserId: z.number().optional(),
      createdByUserName: z.string().optional(),
      createdByOrganization: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const contractNumber = input.contractNumber || await generateContractNumber();
      
      // Convert empty amount strings from the form to NULL for MySQL DECIMAL columns.
      const amount = normalizeOptionalDecimal(input.amount);
      const vatRate = input.vatRate ?? 22;
      const vatAmount = calculateVatAmount(amount, input.amountNotSpecified, vatRate);

      const contractId = await createContract({
        contractNumber,
        contractDate: new Date(input.contractDate),
        subject: input.subject,
        contractType: input.contractType,
        status: "draft",
        amount: input.amountNotSpecified ? null : amount,
        amountNotSpecified: input.amountNotSpecified,
        vatRate: vatRate,
        vatAmount: vatAmount,
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
        prolongation: input.prolongation,
        counterpartyId: input.counterpartyId,
        counterpartyInn: input.counterpartyInn,
        counterpartyEmail: input.counterpartyEmail,
        customerInn: input.customerInn,
        customerName: input.customerName,
        paymentFrequency: "none",
        createdByUserId: input.createdByUserId,
      });

      // Add initial status history
      await addStatusHistory({
        contractId,
        previousStatus: null,
        newStatus: "draft",
        changedByUserId: input.createdByUserId,
        changedByUserName: input.createdByUserName || "Система",
        comment: "Договор создан",
      });

      // Add to unified history
      await addContractHistory({
        contractId,
        eventType: "status_change",
        previousStatus: null,
        newStatus: "draft",
        comment: "Договор создан",
        userId: input.createdByUserId,
        userName: input.createdByUserName || "Система",
        userOrganization: input.createdByOrganization,
      });

      return { id: contractId, contractNumber };
    }),

  update: publicProcedure
    .input(z.object({
      id: z.number(),
      subject: z.string().optional(),
      contractType: z.enum(["supply", "rent", "services", "work", "lease", "other"]).optional(),
      amount: z.string().optional(),
      amountNotSpecified: z.boolean().optional(),
      vatRate: z.number().optional(), // 22 or 0 (без НДС)
      validUntil: z.string().optional(),
      prolongation: z.boolean().optional(),
      counterpartyId: z.number().optional(),
      counterpartyInn: z.string().optional(),
      counterpartyEmail: z.string().email().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, validUntil, vatRate, amount: rawAmount, amountNotSpecified, ...rest } = input;
      const amount = normalizeOptionalDecimal(rawAmount);
      const effectiveVatRate = vatRate ?? 22;
      const shouldUpdateAmount = rawAmount !== undefined || amountNotSpecified !== undefined;

      await updateContract(id, {
        ...rest,
        ...(amountNotSpecified !== undefined ? { amountNotSpecified } : {}),
        ...(shouldUpdateAmount ? { amount: amountNotSpecified ? null : amount } : {}),
        vatRate: effectiveVatRate,
        vatAmount: shouldUpdateAmount ? calculateVatAmount(amount, amountNotSpecified, effectiveVatRate) : undefined,
        validUntil: validUntil ? new Date(validUntil) : undefined,
      });

      return { success: true };
    }),

  changeStatus: publicProcedure
    .input(z.object({
      id: z.number(),
      newStatus: z.enum([
        "draft", "pending_customer", "pending_contractor",
        "awaiting_payment", "paid", "in_progress", "act_signing", "completed", "rejected"
      ]),
      comment: z.string().optional(),
      changedByUserId: z.number().optional(),
      changedByUserName: z.string().optional(),
      changedByOrganization: z.string().optional(),
      userInn: z.string(),
      canApprove: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const contract = await getContractById(input.id);
      if (!contract) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Договор не найден" });
      }

      const currentStatus = contract.status as ContractStatus;
      const allowedTransitions = STATUS_TRANSITIONS[currentStatus] || [];
      
      if (!allowedTransitions.includes(input.newStatus)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Невозможно перейти из статуса "${CONTRACT_STATUSES[currentStatus].label}" в "${CONTRACT_STATUSES[input.newStatus].label}"`,
        });
      }

      // Check if user has permission to change status
      const isCustomer = contract.customerInn === input.userInn;
      const isContractor = contract.counterpartyInn === input.userInn;

      // Check status change permissions
      if (CUSTOMER_CHANGEABLE_STATUSES.includes(currentStatus)) {
        if (!isCustomer) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Только заказчик может изменить статус на данном этапе",
          });
        }
      } else if (CONTRACTOR_CHANGEABLE_STATUSES.includes(currentStatus)) {
        if (!isContractor) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Только контрагент может изменить статус на данном этапе",
          });
        }
      }

      // Check approval permission for certain transitions
      if ((currentStatus === "pending_customer" || currentStatus === "pending_contractor") && 
          input.newStatus !== "rejected") {
        if (!input.canApprove) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "У вас нет права на согласование договоров",
          });
        }
      }

      // Check payment receipt for "paid" status
      if (input.newStatus === "paid") {
        const hasReceipt = await hasPaymentReceipt(input.id);
        if (!hasReceipt) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Для перевода в статус 'Оплачен' необходимо прикрепить чек об оплате",
          });
        }
      }

      await updateContract(input.id, {
        status: input.newStatus,
        rejectionComment: input.newStatus === "rejected" ? input.comment : undefined,
      });

      await addStatusHistory({
        contractId: input.id,
        previousStatus: currentStatus,
        newStatus: input.newStatus,
        changedByUserId: input.changedByUserId,
        changedByUserName: input.changedByUserName || "Пользователь",
        comment: input.comment,
      });

      // Add to unified history
      await addContractHistory({
        contractId: input.id,
        eventType: "status_change",
        previousStatus: currentStatus,
        newStatus: input.newStatus,
        comment: input.comment,
        userId: input.changedByUserId,
        userName: input.changedByUserName || "Пользователь",
        userOrganization: input.changedByOrganization,
      });

      // Create notifications for other users
      await createNotificationsForContract(
        input.id,
        contract.contractNumber,
        "status_change",
        `Изменение статуса договора ${contract.contractNumber}`,
        `Статус изменен на: ${CONTRACT_STATUSES[input.newStatus].label}`,
        input.changedByUserId,
        input.changedByUserName,
        input.changedByOrganization,
        input.userInn // Exclude actor's organization
      );

      // Generate contract document on first save (draft -> pending_customer).
      // Document storage can be unavailable or return an HTML error page when proxy
      // settings are wrong; this must not roll back a valid status transition.
      try {
        if (currentStatus === "draft" && input.newStatus === "pending_customer" && !contract.generatedContractUrl) {
          const counterparty = await getCounterpartyById(contract.counterpartyId);
          if (counterparty) {
            const html = generateContractHtml(contract, counterparty, contract.customerName || 'ООО "Рога и копыта"');
            const fileKey = `contracts/${contract.id}/contract-${contract.contractNumber}.html`;
            const { url } = await storagePut(fileKey, Buffer.from(html), "text/html");
            await updateContract(contract.id, { generatedContractUrl: url });
            await addContractFile({
              contractId: contract.id,
              fileName: `contract-${contract.contractNumber}.html`,
              originalName: `Договор ${contract.contractNumber}.html`,
              fileUrl: url,
              fileKey,
              fileSize: Buffer.from(html).length,
              mimeType: "text/html",
              fileType: "contract",
              uploadedByUserName: "Система",
            });
            
            // Log file addition to history
            await addContractHistory({
              contractId: contract.id,
              eventType: "file_added",
              fileName: `Договор ${contract.contractNumber}.html`,
              fileType: "contract",
              userId: input.changedByUserId,
              userName: "Система",
            });
            
            console.log(`[DOCUMENT] Generated contract document for ${contract.contractNumber}`);
          }
        }
      } catch (error) {
        console.error(
          `[DOCUMENT] Failed to generate contract document for ${contract.contractNumber}: ${getErrorMessage(error)}`
        );
      }

      // Generate act when status changes to "act_signing" (подписание акта).
      // Keep the workflow moving even if the external storage proxy fails.
      try {
        if (input.newStatus === "act_signing" && !contract.generatedActUrl) {
          const counterparty = await getCounterpartyById(contract.counterpartyId);
          if (counterparty) {
            const html = generateActHtml(contract, counterparty, contract.customerName || 'ООО "Рога и копыта"');
            const fileKey = `contracts/${contract.id}/act-${contract.contractNumber}.html`;
            const { url } = await storagePut(fileKey, Buffer.from(html), "text/html");
            await updateContract(contract.id, { generatedActUrl: url });
            await addContractFile({
              contractId: contract.id,
              fileName: `act-${contract.contractNumber}.html`,
              originalName: `Акт ${contract.contractNumber}.html`,
              fileUrl: url,
              fileKey,
              fileSize: Buffer.from(html).length,
              mimeType: "text/html",
              fileType: "act",
              uploadedByUserName: "Система",
            });
            
            // Log file addition to history
            await addContractHistory({
              contractId: contract.id,
              eventType: "file_added",
              fileName: `Акт ${contract.contractNumber}.html`,
              fileType: "act",
              userId: input.changedByUserId,
              userName: "Система",
            });
            
            console.log(`[DOCUMENT] Generated act for ${contract.contractNumber}`);
          }
        }
      } catch (error) {
        console.error(
          `[DOCUMENT] Failed to generate act for ${contract.contractNumber}: ${getErrorMessage(error)}`
        );
      }

      // Log email notification (stub)
      const counterparty = await getCounterpartyById(contract.counterpartyId);
      if (counterparty?.email || contract.counterpartyEmail) {
        const email = contract.counterpartyEmail || counterparty?.email || "";
        console.log(`[EMAIL STUB] Sending notification to ${email} about status change to ${input.newStatus}`);
        
        await logEmailNotification({
          contractId: input.id,
          recipientEmail: email,
          subject: `Изменение статуса договора ${contract.contractNumber}`,
          body: `Статус договора изменен на: ${CONTRACT_STATUSES[input.newStatus].label}`,
          status: "sent",
        });
      }

      return { success: true };
    }),

  addComment: publicProcedure
    .input(z.object({
      contractId: z.number(),
      comment: z.string().min(1, "Комментарий не может быть пустым"),
      userId: z.number().optional(),
      userName: z.string(),
      userOrganization: z.string().optional(),
      userInn: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const contract = await getContractById(input.contractId);
      if (!contract) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Договор не найден" });
      }

      await addContractHistory({
        contractId: input.contractId,
        eventType: "comment",
        comment: input.comment,
        userId: input.userId,
        userName: input.userName,
        userOrganization: input.userOrganization,
      });

      // Create notifications for other users
      await createNotificationsForContract(
        input.contractId,
        contract.contractNumber,
        "comment_added",
        `Новый комментарий к договору ${contract.contractNumber}`,
        input.comment.substring(0, 100) + (input.comment.length > 100 ? "..." : ""),
        input.userId,
        input.userName,
        input.userOrganization,
        input.userInn
      );

      return { success: true };
    }),

  getStats: publicProcedure
    .input(z.object({ userInn: z.string().optional() }).optional())
    .query(async ({ input }) => {
      return await getContractStats(input?.userInn);
    }),

  getUrgent: publicProcedure
    .input(z.object({ hours: z.number().default(48), userInn: z.string().optional() }).optional())
    .query(async ({ input }) => {
      return await getUrgentContracts(input?.hours || 48, input?.userInn);
    }),

  getHistory: publicProcedure
    .input(z.object({ contractId: z.number() }))
    .query(async ({ input }) => {
      return await getContractHistory(input.contractId);
    }),
});

// ============ COUNTERPARTIES ROUTER ============
const counterpartiesRouter = router({
  list: publicProcedure.query(async () => {
    return await getAllCounterparties();
  }),

  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return await getCounterpartyById(input.id);
    }),

  getByInn: publicProcedure
    .input(z.object({ inn: z.string() }))
    .query(async ({ input }) => {
      // First check known organizations
      const known = KNOWN_ORGANIZATIONS.find(org => org.inn === input.inn);
      if (known) {
        // Return as counterparty-like object
        const existing = await getCounterpartyByInn(input.inn);
        if (existing) return existing;
        
        // Create new counterparty from known organization
        const id = await upsertCounterparty({
          inn: known.inn,
          name: known.name,
          shortName: known.shortName,
          address: known.address,
          directorName: known.directorName,
        });
        return await getCounterpartyById(id);
      }
      return await getCounterpartyByInn(input.inn);
    }),

  search: publicProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ input }) => {
      // First check known organizations
      const knownMatches = KNOWN_ORGANIZATIONS.filter(org => 
        org.inn.includes(input.query) || 
        org.name.toLowerCase().includes(input.query.toLowerCase())
      );
      
      const dbResults = await searchCounterparties(input.query);
      
      // Merge results, preferring known organizations
      const allResults = [...knownMatches.map(org => ({
        id: 0,
        inn: org.inn,
        name: org.name,
        shortName: org.shortName,
        address: org.address,
        directorName: org.directorName,
        kpp: null,
        ogrn: null,
        email: null,
        phone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })), ...dbResults];
      
      // Remove duplicates by INN
      const uniqueResults = allResults.filter((item, index, self) => 
        index === self.findIndex(t => t.inn === item.inn)
      );
      
      return uniqueResults.slice(0, 10);
    }),

  upsert: publicProcedure
    .input(z.object({
      inn: z.string().min(10).max(12),
      name: z.string().min(1),
      shortName: z.string().optional(),
      kpp: z.string().optional(),
      ogrn: z.string().optional(),
      address: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      directorName: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await upsertCounterparty(input);
      return { id };
    }),

  // External API lookup simulation
  lookupByInn: publicProcedure
    .input(z.object({ inn: z.string() }))
    .query(async ({ input }) => {
      // Check known organizations first
      const known = KNOWN_ORGANIZATIONS.find(org => org.inn === input.inn);
      if (known) {
        return {
          found: true,
          data: {
            inn: known.inn,
            name: known.name,
            shortName: known.shortName,
            address: known.address,
            directorName: known.directorName,
          }
        };
      }
      
      // Simulate external API lookup
      console.log(`[API STUB] Looking up INN: ${input.inn}`);
      
      // For demo purposes, generate fake data for any INN
      if (input.inn.length >= 10) {
        return {
          found: true,
          data: {
            inn: input.inn,
            name: `Компания ${input.inn.slice(-4)}`,
            shortName: `Компания ${input.inn.slice(-4)}`,
            kpp: input.inn.length === 10 ? `${input.inn.slice(0, 4)}01001` : undefined,
            ogrn: `1${input.inn}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
            address: `г. Москва, ул. Примерная, д. ${Math.floor(Math.random() * 100)}`,
            directorName: "Иванов И.И.",
          }
        };
      }
      
      return { found: false, data: null };
    }),
});

// ============ FILES ROUTER ============
const filesRouter = router({
  list: publicProcedure
    .input(z.object({ contractId: z.number() }))
    .query(async ({ input }) => {
      return await getContractFiles(input.contractId);
    }),

  upload: publicProcedure
    .input(z.object({
      contractId: z.number(),
      fileName: z.string(),
      originalName: z.string(),
      fileData: z.string(), // base64 encoded
      mimeType: z.string(),
      fileType: z.enum(["contract", "act", "signed_contract", "payment_receipt", "additional"]),
      uploadedByUserId: z.number().optional(),
      uploadedByUserName: z.string().optional(),
      uploadedByOrganization: z.string().optional(),
      uploadedByUserInn: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // Decode base64
      const buffer = Buffer.from(input.fileData, "base64");
      
      // Check file size (10 MB limit)
      if (buffer.length > 10 * 1024 * 1024) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Размер файла превышает 10 МБ",
        });
      }

      // Generate unique file key
      const fileKey = `contracts/${input.contractId}/${nanoid()}-${input.fileName}`;
      
      // Upload to S3
      const { url } = await storagePut(fileKey, buffer, input.mimeType);

      // Save file record
      const fileId = await addContractFile({
        contractId: input.contractId,
        fileName: input.fileName,
        originalName: input.originalName,
        fileUrl: url,
        fileKey,
        fileSize: buffer.length,
        mimeType: input.mimeType,
        fileType: input.fileType,
        uploadedByUserId: input.uploadedByUserId,
        uploadedByUserName: input.uploadedByUserName,
      });

      // Log file addition to history
      await addContractHistory({
        contractId: input.contractId,
        eventType: "file_added",
        fileName: input.originalName,
        fileType: input.fileType,
        userId: input.uploadedByUserId,
        userName: input.uploadedByUserName || "Пользователь",
        userOrganization: input.uploadedByOrganization,
      });

      // Create notifications for other users
      const contract = await getContractById(input.contractId);
      if (contract) {
        const fileTypeLabels: Record<string, string> = {
          contract: "Договор",
          act: "Акт",
          signed_contract: "Подписанный договор",
          payment_receipt: "Чек об оплате",
          additional: "Документ",
        };
        await createNotificationsForContract(
          input.contractId,
          contract.contractNumber,
          "file_added",
          `Добавлен файл к договору ${contract.contractNumber}`,
          `${fileTypeLabels[input.fileType] || "Файл"}: ${input.originalName}`,
          input.uploadedByUserId,
          input.uploadedByUserName,
          input.uploadedByOrganization,
          input.uploadedByUserInn
        );
      }

      return { id: fileId, url };
    }),

  delete: publicProcedure
    .input(z.object({ 
      fileId: z.number(),
      deletedByUserId: z.number().optional(),
      deletedByUserName: z.string().optional(),
      deletedByOrganization: z.string().optional(),
      deletedByUserInn: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // Get file info before deleting
      const file = await getContractFileById(input.fileId);
      
      if (file) {
        await deleteContractFile(input.fileId, input.deletedByUserId, input.deletedByUserName);
        
        // Log file removal to history
        await addContractHistory({
          contractId: file.contractId,
          eventType: "file_removed",
          fileName: file.originalName,
          fileType: file.fileType,
          userId: input.deletedByUserId,
          userName: input.deletedByUserName || "Пользователь",
          userOrganization: input.deletedByOrganization,
        });

        // Create notifications for other users
        const contract = await getContractById(file.contractId);
        if (contract) {
          await createNotificationsForContract(
            file.contractId,
            contract.contractNumber,
            "file_removed",
            `Удален файл из договора ${contract.contractNumber}`,
            `Файл: ${file.originalName}`,
            input.deletedByUserId,
            input.deletedByUserName,
            input.deletedByOrganization,
            input.deletedByUserInn
          );
        }
      }
      
      return { success: true };
    }),
});

// ============ PREDEFINED USERS ROUTER ============
const predefinedUsersRouter = router({
  list: publicProcedure.query(async () => {
    return await getAllPredefinedUsers();
  }),

  getByLogin: publicProcedure
    .input(z.object({ login: z.string() }))
    .query(async ({ input }) => {
      return await getPredefinedUserByLogin(input.login);
    }),

  authenticate: publicProcedure
    .input(z.object({
      login: z.string(),
      password: z.string(),
    }))
    .mutation(async ({ input }) => {
      const user = await getPredefinedUserByLogin(input.login);
      
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Пользователь не найден" });
      }
      
      if (user.password !== input.password) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Неверный пароль" });
      }
      
      return user;
    }),

  // Alias for authenticate
  login: publicProcedure
    .input(z.object({
      login: z.string(),
      password: z.string(),
    }))
    .mutation(async ({ input }) => {
      const user = await getPredefinedUserByLogin(input.login);
      
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Пользователь не найден" });
      }
      
      if (user.password !== input.password) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Неверный пароль" });
      }
      
      return user;
    }),

  initializeUsers: publicProcedure.mutation(async () => {
    const users = [
      {
        login: "it_head",
        password: "it@rogakopita",
        displayName: "Начальник управления ИТ",
        organization: 'ООО "Рога и копыта"',
        organizationInn: "7707083893",
        role: "it_head" as const,
        canApprove: false,
        email: "it_head@rogakopita.ru",
      },
      {
        login: "director_roga",
        password: "dir@rogakopita",
        displayName: "Директор",
        organization: 'ООО "Рога и копыта"',
        organizationInn: "7707083893",
        role: "director_roga" as const,
        canApprove: true,
        email: "director@rogakopita.ru",
      },
      {
        login: "director_hlyp",
        password: "dir@hlyp",
        displayName: "Директор",
        organization: 'Хлыпало и КО',
        organizationInn: "1111111111",
        role: "director_hlyp" as const,
        canApprove: true,
        email: "director@hlyp.ru",
      },
    ];

    for (const user of users) {
      await createPredefinedUser(user);
    }

    return { success: true, count: users.length };
  }),
});

// ============ DOCUMENTS ROUTER ============
const documentsRouter = router({
  generateContract: publicProcedure
    .input(z.object({ contractId: z.number() }))
    .mutation(async ({ input }) => {
      const contract = await getContractById(input.contractId);
      if (!contract) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Договор не найден" });
      }

      const counterparty = await getCounterpartyById(contract.counterpartyId);
      if (!counterparty) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Контрагент не найден" });
      }

      const html = generateContractHtml(contract, counterparty, contract.customerName || 'ООО "Рога и копыта"');
      
      // Save HTML as file
      const fileKey = `contracts/${contract.id}/contract-${contract.contractNumber}.html`;
      const { url } = await storagePut(fileKey, Buffer.from(html), "text/html");

      // Update contract with generated document URL
      await updateContract(contract.id, { generatedContractUrl: url });

      // Add file record
      await addContractFile({
        contractId: contract.id,
        fileName: `contract-${contract.contractNumber}.html`,
        originalName: `Договор ${contract.contractNumber}.html`,
        fileUrl: url,
        fileKey,
        fileSize: Buffer.from(html).length,
        mimeType: "text/html",
        fileType: "contract",
        uploadedByUserName: "Система",
      });

      return { url };
    }),

  generateAct: publicProcedure
    .input(z.object({ contractId: z.number() }))
    .mutation(async ({ input }) => {
      const contract = await getContractById(input.contractId);
      if (!contract) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Договор не найден" });
      }

      const counterparty = await getCounterpartyById(contract.counterpartyId);
      if (!counterparty) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Контрагент не найден" });
      }

      const html = generateActHtml(contract, counterparty, contract.customerName || 'ООО "Рога и копыта"');
      
      // Save HTML as file
      const fileKey = `contracts/${contract.id}/act-${contract.contractNumber}.html`;
      const { url } = await storagePut(fileKey, Buffer.from(html), "text/html");

      // Update contract with generated act URL
      await updateContract(contract.id, { generatedActUrl: url });

      // Add file record
      await addContractFile({
        contractId: contract.id,
        fileName: `act-${contract.contractNumber}.html`,
        originalName: `Акт ${contract.contractNumber}.html`,
        fileUrl: url,
        fileKey,
        fileSize: Buffer.from(html).length,
        mimeType: "text/html",
        fileType: "act",
        uploadedByUserName: "Система",
      });

      return { url };
    }),
});

// ============ DASHBOARD ROUTER ============
const dashboardRouter = router({
  stats: publicProcedure
    .input(z.object({ userInn: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const stats = await getContractStats(input?.userInn);
      const urgent = await getUrgentContracts(48, input?.userInn);
      const allContracts = await getAllContracts();
      
      // Filter contracts by user if userInn provided
      const filteredContracts = input?.userInn 
        ? allContracts.filter(c => c.customerInn === input.userInn || c.counterpartyInn === input.userInn)
        : allContracts;
      
      // Calculate calendar events
      const calendarEvents = filteredContracts.map(contract => ({
        id: contract.id,
        title: contract.contractNumber,
        date: contract.contractDate,
        validUntil: contract.validUntil,
        status: contract.status,
      }));

      return {
        stats,
        urgentContracts: urgent,
        calendarEvents,
        totalAmount: filteredContracts.reduce((sum, c) => {
          const amount = c.amount ? parseFloat(c.amount) : 0;
          return sum + amount;
        }, 0),
      };
    }),
});

// ============ NOTIFICATIONS ROUTER ============
const notificationsRouter = router({
  list: publicProcedure
    .input(z.object({ userInn: z.string() }))
    .query(async ({ input }) => {
      return await getNotificationsForUser(input.userInn);
    }),

  unreadCount: publicProcedure
    .input(z.object({ userInn: z.string() }))
    .query(async ({ input }) => {
      return await getUnreadNotificationCount(input.userInn);
    }),

  markAsRead: publicProcedure
    .input(z.object({ notificationId: z.number() }))
    .mutation(async ({ input }) => {
      await markNotificationAsRead(input.notificationId);
      return { success: true };
    }),

  markAllAsRead: publicProcedure
    .input(z.object({ userInn: z.string() }))
    .mutation(async ({ input }) => {
      await markAllNotificationsAsRead(input.userInn);
      return { success: true };
    }),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  contracts: contractsRouter,
  counterparties: counterpartiesRouter,
  files: filesRouter,
  predefinedUsers: predefinedUsersRouter,
  dashboard: dashboardRouter,
  documents: documentsRouter,
  notifications: notificationsRouter,
});

export type AppRouter = typeof appRouter;
