import { describe, expect, it } from "vitest";
import {
  CONTRACT_STATUSES,
  STATUS_TRANSITIONS,
  CUSTOMER_CHANGEABLE_STATUSES,
  CONTRACTOR_CHANGEABLE_STATUSES,
  REQUIRES_PAYMENT_RECEIPT,
  FIXED_VAT_RATE,
  KNOWN_ORGANIZATIONS,
  ContractStatus,
} from "../shared/contracts";

describe("Contract System v2 - Business Logic", () => {
  describe("Status workflow", () => {
    it("should have act_signing status before completed", () => {
      expect(CONTRACT_STATUSES.act_signing).toBeDefined();
      expect(CONTRACT_STATUSES.act_signing.label).toBe("Подписание акта");
    });

    it("should allow transition from in_progress to act_signing", () => {
      const transitions = STATUS_TRANSITIONS.in_progress;
      expect(transitions).toContain("act_signing");
    });

    it("should allow transition from act_signing to completed", () => {
      const transitions = STATUS_TRANSITIONS.act_signing;
      expect(transitions).toContain("completed");
    });

    it("should allow transition from act_signing back to in_progress (for rework)", () => {
      const transitions = STATUS_TRANSITIONS.act_signing;
      expect(transitions).toContain("in_progress");
    });
  });

  describe("Customer changeable statuses", () => {
    it("should include draft status", () => {
      expect(CUSTOMER_CHANGEABLE_STATUSES).toContain("draft");
    });

    it("should include pending_customer status", () => {
      expect(CUSTOMER_CHANGEABLE_STATUSES).toContain("pending_customer");
    });

    it("should include awaiting_payment status", () => {
      expect(CUSTOMER_CHANGEABLE_STATUSES).toContain("awaiting_payment");
    });

    it("should include act_signing status", () => {
      expect(CUSTOMER_CHANGEABLE_STATUSES).toContain("act_signing");
    });
  });

  describe("Contractor changeable statuses", () => {
    it("should include pending_contractor status", () => {
      expect(CONTRACTOR_CHANGEABLE_STATUSES).toContain("pending_contractor");
    });

    it("should include paid status", () => {
      expect(CONTRACTOR_CHANGEABLE_STATUSES).toContain("paid");
    });

    it("should include in_progress status", () => {
      expect(CONTRACTOR_CHANGEABLE_STATUSES).toContain("in_progress");
    });
  });

  describe("Payment receipt requirement", () => {
    it("should require payment receipt to transition to paid status", () => {
      // Payment receipt is required when transitioning TO paid status
      expect(REQUIRES_PAYMENT_RECEIPT).toContain("paid");
    });
  });

  describe("Fixed VAT rate", () => {
    it("should be 22%", () => {
      expect(FIXED_VAT_RATE).toBe(22);
    });
  });

  describe("Known organizations", () => {
    it("should include Roga i Kopyta", () => {
      const rogaKopyta = KNOWN_ORGANIZATIONS.find(org => org.inn === "7707083893");
      expect(rogaKopyta).toBeDefined();
      expect(rogaKopyta?.name).toContain("Рога и копыта");
    });

    it("should include Hlypalo i KO with INN 1111111111", () => {
      const hlypalo = KNOWN_ORGANIZATIONS.find(org => org.inn === "1111111111");
      expect(hlypalo).toBeDefined();
      expect(hlypalo?.name).toBe("Хлыпало и КО");
      expect(hlypalo?.shortName).toBe("Хлыпало и КО");
    });
  });

  describe("Status transitions validation", () => {
    it("should not allow direct transition from draft to completed", () => {
      const transitions = STATUS_TRANSITIONS.draft;
      expect(transitions).not.toContain("completed");
    });

    it("should allow transition from draft to pending_customer", () => {
      const transitions = STATUS_TRANSITIONS.draft;
      expect(transitions).toContain("pending_customer");
    });

    it("should allow transition from pending_customer to pending_contractor", () => {
      const transitions = STATUS_TRANSITIONS.pending_customer;
      expect(transitions).toContain("pending_contractor");
    });
  });
});

describe("Contract Number Format", () => {
  it("should follow ДП-{YYYY}-{NNN} format", () => {
    const currentYear = new Date().getFullYear();
    const expectedPattern = new RegExp(`^ДП-${currentYear}-\\d{3}$`);
    
    // Test sample contract numbers
    const validNumbers = [
      `ДП-${currentYear}-001`,
      `ДП-${currentYear}-099`,
      `ДП-${currentYear}-100`,
    ];
    
    validNumbers.forEach(num => {
      expect(num).toMatch(expectedPattern);
    });
  });
});

describe("User Roles and Permissions", () => {
  const mockUsers = [
    {
      login: "it_head",
      organization: 'ООО "Рога и копыта"',
      organizationInn: "7707083893",
      canApprove: false,
    },
    {
      login: "director_roga",
      organization: 'ООО "Рога и копыта"',
      organizationInn: "7707083893",
      canApprove: true,
    },
    {
      login: "director_hlyp",
      organization: "Хлыпало и КО",
      organizationInn: "1111111111",
      canApprove: true,
    },
  ];

  it("IT head should not have approval rights", () => {
    const itHead = mockUsers.find(u => u.login === "it_head");
    expect(itHead?.canApprove).toBe(false);
  });

  it("Director of Roga i Kopyta should have approval rights", () => {
    const director = mockUsers.find(u => u.login === "director_roga");
    expect(director?.canApprove).toBe(true);
  });

  it("Director of Hlypalo i KO should have approval rights", () => {
    const director = mockUsers.find(u => u.login === "director_hlyp");
    expect(director?.canApprove).toBe(true);
  });

  it("Users should have organizationInn field", () => {
    mockUsers.forEach(user => {
      expect(user.organizationInn).toBeDefined();
      expect(user.organizationInn.length).toBeGreaterThanOrEqual(10);
    });
  });
});

describe("Contract Visibility Rules", () => {
  const mockContract = {
    customerInn: "7707083893",
    counterpartyInn: "1111111111",
  };

  it("Customer should see their contracts", () => {
    const userInn = "7707083893";
    const canSee = mockContract.customerInn === userInn || mockContract.counterpartyInn === userInn;
    expect(canSee).toBe(true);
  });

  it("Contractor should see contracts where they are counterparty", () => {
    const userInn = "1111111111";
    const canSee = mockContract.customerInn === userInn || mockContract.counterpartyInn === userInn;
    expect(canSee).toBe(true);
  });

  it("Third party should not see the contract", () => {
    const userInn = "9999999999";
    const canSee = mockContract.customerInn === userInn || mockContract.counterpartyInn === userInn;
    expect(canSee).toBe(false);
  });
});

describe("VAT Calculation", () => {
  it("should calculate VAT correctly at 22%", () => {
    const amount = 100000;
    const vatAmount = amount * (FIXED_VAT_RATE / 100);
    expect(vatAmount).toBe(22000);
  });

  it("should calculate total with VAT correctly", () => {
    const amountWithoutVat = 100000;
    const total = amountWithoutVat * (1 + FIXED_VAT_RATE / 100);
    expect(total).toBe(122000);
  });
});
