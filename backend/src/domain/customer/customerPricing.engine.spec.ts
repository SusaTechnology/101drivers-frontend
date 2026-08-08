/**
 * Unit tests for CustomerPricingEngine.bulkAssignPricing (Item 14).
 *
 * Verifies:
 *  - Throws NotFoundException when the pricing config doesn't exist.
 *  - Successfully assigns the config to multiple customers.
 *  - Collects per-customer failures (skip-and-report) without aborting.
 *  - Returns accurate assigned/failed counts.
 *  - Passes pricingModeOverride/postpaidEnabled/note through to assignPricing.
 */
import { NotFoundException } from "@nestjs/common";
import { CustomerPricingEngine } from "./customerPricing.engine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockPrisma = any;

const CONFIG_ID = "cfg_test_001";
const CUST_A = "cust_A";
const CUST_B = "cust_B";
const CUST_C = "cust_C";

const makeMockPrisma = (configExists = true): MockPrisma => {
  return {
    pricingConfig: {
      findUnique: jest.fn(async () =>
        configExists ? { id: CONFIG_ID } : null
      ),
    },
    customer: {
      // The assignPricing method calls findUnique twice (before + after)
      // and then update. We mock per-test as needed.
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    adminAuditLog: { create: jest.fn() },
  };
};

describe("CustomerPricingEngine.bulkAssignPricing", () => {
  let engine: CustomerPricingEngine;
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = makeMockPrisma(true);
    engine = new CustomerPricingEngine(prisma);
  });

  it("throws NotFoundException when the pricing config does not exist", async () => {
    prisma = makeMockPrisma(false);
    engine = new CustomerPricingEngine(prisma);

    await expect(
      engine.bulkAssignPricing({
        pricingConfigId: "nope",
        customerIds: [CUST_A, CUST_B],
      })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("successfully assigns all customers when all are valid", async () => {
    // Mock assignPricing to succeed for all 3 customers.
    // assignPricing flow: findUnique (returns valid BUSINESS APPROVED customer) -> update -> findUnique (after) -> auditLog.create
    const validCustomer = {
      id: CUST_A,
      customerType: "BUSINESS",
      approvalStatus: "APPROVED",
      pricingConfigId: null,
      pricingModeOverride: null,
      postpaidEnabled: false,
    };
    prisma.customer.findUnique.mockResolvedValue(validCustomer);
    prisma.customer.update.mockResolvedValue({});

    const result = await engine.bulkAssignPricing({
      pricingConfigId: CONFIG_ID,
      customerIds: [CUST_A, CUST_B, CUST_C],
    });

    expect(result.assigned).toBe(3);
    expect(result.failed).toEqual([]);
    // 3 customers × (1 findUnique before + 1 update + 1 findUnique after + 1 auditLog.create)
    expect(prisma.customer.findUnique).toHaveBeenCalledTimes(6);
    expect(prisma.customer.update).toHaveBeenCalledTimes(3);
    expect(prisma.adminAuditLog.create).toHaveBeenCalledTimes(3);
  });

  it("collects per-customer failures without aborting (skip-and-report)", async () => {
    // Mock: CUST_A is BUSINESS/APPROVED → succeeds.
    //       CUST_B is PRIVATE → throws BadRequestException.
    //       CUST_C is BUSINESS/APPROVED → succeeds.
    const businessApproved = {
      id: CUST_A,
      customerType: "BUSINESS",
      approvalStatus: "APPROVED",
      pricingConfigId: null,
      pricingModeOverride: null,
      postpaidEnabled: false,
    };
    const privateCustomer = {
      id: CUST_B,
      customerType: "PRIVATE",
      approvalStatus: "APPROVED",
      pricingConfigId: null,
      pricingModeOverride: null,
      postpaidEnabled: false,
    };

    prisma.customer.findUnique
      .mockResolvedValueOnce(businessApproved) // CUST_A before
      .mockResolvedValueOnce({ ...businessApproved, id: CUST_A, pricingConfigId: CONFIG_ID }) // CUST_A after
      .mockResolvedValueOnce(privateCustomer) // CUST_B before (PRIVATE → throws)
      .mockResolvedValueOnce(businessApproved) // CUST_C before
      .mockResolvedValueOnce({ ...businessApproved, id: CUST_C, pricingConfigId: CONFIG_ID }); // CUST_C after
    prisma.customer.update.mockResolvedValue({});

    const result = await engine.bulkAssignPricing({
      pricingConfigId: CONFIG_ID,
      customerIds: [CUST_A, CUST_B, CUST_C],
    });

    expect(result.assigned).toBe(2);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].customerId).toBe(CUST_B);
    expect(result.failed[0].error).toContain("BUSINESS");
  });

  it("returns assigned=0 when all customers fail", async () => {
    const privateCustomer = {
      id: CUST_A,
      customerType: "PRIVATE",
      approvalStatus: "APPROVED",
      pricingConfigId: null,
      pricingModeOverride: null,
      postpaidEnabled: false,
    };
    prisma.customer.findUnique.mockResolvedValue(privateCustomer);

    const result = await engine.bulkAssignPricing({
      pricingConfigId: CONFIG_ID,
      customerIds: [CUST_A, CUST_B, CUST_C],
    });

    expect(result.assigned).toBe(0);
    expect(result.failed).toHaveLength(3);
    expect(prisma.customer.update).not.toHaveBeenCalled();
    expect(prisma.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it("handles empty customerIds array gracefully", async () => {
    const result = await engine.bulkAssignPricing({
      pricingConfigId: CONFIG_ID,
      customerIds: [],
    });

    expect(result.assigned).toBe(0);
    expect(result.failed).toEqual([]);
    expect(prisma.customer.findUnique).not.toHaveBeenCalled();
  });

  it("passes pricingModeOverride, postpaidEnabled, and note through to assignPricing", async () => {
    const businessApproved = {
      id: CUST_A,
      customerType: "BUSINESS",
      approvalStatus: "APPROVED",
      pricingConfigId: null,
      pricingModeOverride: null,
      postpaidEnabled: false,
    };
    prisma.customer.findUnique.mockResolvedValue(businessApproved);
    prisma.customer.update.mockResolvedValue({});

    await engine.bulkAssignPricing({
      pricingConfigId: CONFIG_ID,
      customerIds: [CUST_A],
      pricingModeOverride: "FLAT_TIER" as any,
      postpaidEnabled: true,
      note: "bulk assign test",
      actorUserId: "admin_001",
    });

    // Verify the customer.update was called with the override + postpaid
    expect(prisma.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CUST_A },
        data: expect.objectContaining({
          pricingModeOverride: "FLAT_TIER",
          postpaidEnabled: true,
        }),
      })
    );
    // Verify the audit log was called with the note + actorUserId
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorUserId: "admin_001",
          customerId: CUST_A,
          reason: "bulk assign test",
        }),
      })
    );
  });
});
