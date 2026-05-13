import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import {
  CONTRACT_STATUSES,
  STATUS_TRANSITIONS,
  CONTRACT_TYPES,
  PAYMENT_FREQUENCIES,
  VAT_RATES,
  FILE_TYPES,
  PREDEFINED_USERS,
  FIXED_VAT_RATE,
} from "../shared/contracts";

// Mock context for testing
function createMockContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "predefined",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("Contract Number Generation", () => {
  it("generates contract number in correct format ДП-YYYY-NNN", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const number = await caller.contracts.generateNumber();
    
    // Should match pattern ДП-YYYY-NNN
    expect(number).toMatch(/^ДП-\d{4}-\d{3}$/);
    
    // Year should be current year
    const currentYear = new Date().getFullYear();
    expect(number).toContain(`ДП-${currentYear}-`);
  });
});

describe("Contract Status Transitions", () => {
  it("validates allowed status transitions", () => {
    // Draft can only go to pending_customer or rejected
    expect(STATUS_TRANSITIONS.draft).toContain("pending_customer");
    expect(STATUS_TRANSITIONS.draft).toContain("rejected");
    expect(STATUS_TRANSITIONS.draft).not.toContain("completed");
    
    // Pending customer can go to pending_contractor or rejected
    expect(STATUS_TRANSITIONS.pending_customer).toContain("pending_contractor");
    expect(STATUS_TRANSITIONS.pending_customer).toContain("rejected");
    
    // In progress goes to act_signing (new workflow)
    expect(STATUS_TRANSITIONS.in_progress).toContain("act_signing");
    
    // Act signing can go to completed or back to in_progress
    expect(STATUS_TRANSITIONS.act_signing).toContain("completed");
    expect(STATUS_TRANSITIONS.act_signing).toContain("in_progress");
  });
  
  it("has correct status labels in Russian", () => {
    expect(CONTRACT_STATUSES.draft.label).toBe("Черновик");
    expect(CONTRACT_STATUSES.pending_customer.label).toBe("На согласовании у заказчика");
    expect(CONTRACT_STATUSES.pending_contractor.label).toBe("На согласовании у исполнителя");
    expect(CONTRACT_STATUSES.awaiting_payment.label).toBe("Ожидает оплаты");
    expect(CONTRACT_STATUSES.paid.label).toBe("Оплачен");
    expect(CONTRACT_STATUSES.in_progress.label).toBe("Выполняется");
    expect(CONTRACT_STATUSES.act_signing.label).toBe("Подписание акта");
    expect(CONTRACT_STATUSES.completed.label).toBe("Завершен");
    expect(CONTRACT_STATUSES.rejected.label).toBe("Отклонен");
  });
});

describe("Contract Types", () => {
  it("has all required contract types", () => {
    expect(CONTRACT_TYPES.supply).toBeDefined();
    expect(CONTRACT_TYPES.services).toBeDefined();
    expect(CONTRACT_TYPES.work).toBeDefined();
    expect(CONTRACT_TYPES.lease).toBeDefined();
    expect(CONTRACT_TYPES.other).toBeDefined();
    expect(CONTRACT_TYPES.rent).toBeDefined();
  });
});

describe("Payment Frequencies", () => {
  it("has all required payment frequencies (disabled)", () => {
    expect(PAYMENT_FREQUENCIES.none).toBeDefined();
    expect(PAYMENT_FREQUENCIES.once).toBeDefined();
    expect(PAYMENT_FREQUENCIES.monthly).toBeDefined();
    expect(PAYMENT_FREQUENCIES.quarterly).toBeDefined();
    expect(PAYMENT_FREQUENCIES.yearly).toBeDefined();
    
    // All should be disabled
    Object.values(PAYMENT_FREQUENCIES).forEach(freq => {
      expect(freq.disabled).toBe(true);
    });
  });
});

describe("VAT Rates", () => {
  it("has fixed 22% VAT rate", () => {
    expect(VAT_RATES).toHaveLength(1);
    expect(VAT_RATES[0].value).toBe(22);
    expect(FIXED_VAT_RATE).toBe(22);
  });
});

describe("File Types", () => {
  it("has all required file types", () => {
    expect(FILE_TYPES.contract).toBeDefined();
    expect(FILE_TYPES.signed_contract).toBeDefined();
    expect(FILE_TYPES.act).toBeDefined();
    expect(FILE_TYPES.payment_receipt).toBeDefined();
    expect(FILE_TYPES.additional).toBeDefined();
  });
});

describe("Predefined Users", () => {
  it("has three predefined users with correct roles and organizations", () => {
    expect(PREDEFINED_USERS).toHaveLength(3);
    
    // IT Manager - no approval rights
    const itManager = PREDEFINED_USERS.find((u) => u.id === "it_manager");
    expect(itManager).toBeDefined();
    expect(itManager!.displayName).toBe("Начальник управления ИТ");
    expect(itManager!.organization).toBe('ООО "Рога и копыта"');
    expect(itManager!.organizationInn).toBe("7707083893");
    expect(itManager!.canApprove).toBe(false);
    
    // Director Roga i Kopyta - has approval rights
    const directorRK = PREDEFINED_USERS.find((u) => u.id === "director_rk");
    expect(directorRK).toBeDefined();
    expect(directorRK!.displayName).toBe("Директор");
    expect(directorRK!.organization).toBe('ООО "Рога и копыта"');
    expect(directorRK!.organizationInn).toBe("7707083893");
    expect(directorRK!.canApprove).toBe(true);
    
    // Director Hlypalo - has approval rights
    const directorH = PREDEFINED_USERS.find((u) => u.id === "director_hlypalo");
    expect(directorH).toBeDefined();
    expect(directorH!.displayName).toBe("Директор");
    expect(directorH!.organization).toBe("Хлыпало и КО");
    expect(directorH!.organizationInn).toBe("1111111111");
    expect(directorH!.canApprove).toBe(true);
  });
});
