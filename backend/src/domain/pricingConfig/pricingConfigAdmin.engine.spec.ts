/**
 * Unit tests for PricingConfigAdminEngine.setDefault.
 *
 * Verifies:
 *  - Throws NotFoundException when the target PricingConfig doesn't exist.
 *  - Atomically unsets isDefault on every other PricingConfig.
 *  - Sets isDefault=true on the target.
 *  - Does NOT modify the `active` flag on any row (active and default are
 *    independent — the old broken behavior was to set active=false on all
 *    other configs, which quietly deactivated them).
 *  - Writes an AdminAuditLog entry capturing the before/after state.
 */
import { PricingConfigAdminEngine } from "./pricingConfigAdmin.engine";
import { NotFoundException } from "@nestjs/common";

// ── helpers ────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockTx = any;

const TARGET_ID = "cfg_target_001";
const OTHER_DEFAULT_ID = "cfg_other_default_002";
const OTHER_NONDEFAULT_ID = "cfg_other_nondflt_003";

const makeMockTx = (): MockTx => {
  const tx = {
    pricingConfig: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    adminAuditLog: { create: jest.fn() },
  };
  return tx;
};

const makeMockPrisma = (tx: MockTx) => {
  return {
    $transaction: jest.fn(async (cb: (tx: MockTx) => Promise<unknown>) =>
      cb(tx),
    ),
  };
};

// ── tests ──────────────────────────────────────────────────────────────────
describe("PricingConfigAdminEngine.setDefault", () => {
  let engine: PricingConfigAdminEngine;
  let tx: MockTx;
  let prisma: ReturnType<typeof makeMockPrisma>;

  beforeEach(() => {
    jest.clearAllMocks();
    tx = makeMockTx();
    prisma = makeMockPrisma(tx);
    engine = new PricingConfigAdminEngine(prisma as any);
  });

  it("throws NotFoundException when the target PricingConfig does not exist", async () => {
    tx.pricingConfig.findUnique.mockResolvedValue(null);

    await expect(
      engine.setDefault({ id: "does-not-exist", actorUserId: "u_001" }),
    ).rejects.toBeInstanceOf(NotFoundException);

    // Must NOT touch any rows or write an audit log when the target is missing.
    expect(tx.pricingConfig.updateMany).not.toHaveBeenCalled();
    expect(tx.pricingConfig.update).not.toHaveBeenCalled();
    expect(tx.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it("atomically unsets isDefault on every other config and sets isDefault=true on the target", async () => {
    tx.pricingConfig.findUnique.mockResolvedValue({
      id: TARGET_ID,
      name: "Standard PER_MILE",
      active: true,
      isDefault: false,
    });
    tx.pricingConfig.findMany.mockResolvedValue([
      { id: OTHER_DEFAULT_ID, name: "Old default" },
    ]);

    await engine.setDefault({ id: TARGET_ID, actorUserId: "u_001" });

    // 1) Looked up the target by id.
    expect(tx.pricingConfig.findUnique).toHaveBeenCalledWith({
      where: { id: TARGET_ID },
      select: {
        id: true,
        name: true,
        active: true,
        isDefault: true,
      },
    });

    // 2) Found any OTHER configs currently marked default.
    expect(tx.pricingConfig.findMany).toHaveBeenCalledWith({
      where: { id: { not: TARGET_ID }, isDefault: true },
      select: { id: true, name: true },
    });

    // 3) Unset isDefault on every OTHER config (scoped to isDefault:true
    //    so we don't touch rows that are already false).
    expect(tx.pricingConfig.updateMany).toHaveBeenCalledTimes(1);
    const updateManyCall = tx.pricingConfig.updateMany.mock.calls[0][0];
    expect(updateManyCall.where).toEqual({
      id: { not: TARGET_ID },
      isDefault: true,
    });
    expect(updateManyCall.data).toEqual({ isDefault: false });

    // 4) Promote the target.
    expect(tx.pricingConfig.update).toHaveBeenCalledTimes(1);
    const updateCall = tx.pricingConfig.update.mock.calls[0][0];
    expect(updateCall.where).toEqual({ id: TARGET_ID });
    expect(updateCall.data).toEqual({ isDefault: true });

    // 5) Wrote an audit log entry.
    expect(tx.adminAuditLog.create).toHaveBeenCalledTimes(1);
    const auditCall = tx.adminAuditLog.create.mock.calls[0][0];
    expect(auditCall.data.actorUserId).toBe("u_001");
    expect(auditCall.data.reason).toMatch(/Standard PER_MILE.*default/);
    expect(auditCall.data.beforeJson.target.isDefault).toBe(false);
    expect(auditCall.data.afterJson.target.isDefault).toBe(true);
    expect(auditCall.data.afterJson.unset).toEqual([
      { id: OTHER_DEFAULT_ID, name: "Old default" },
    ]);
  });

  it("does NOT modify the `active` flag on any row (active and default are independent)", async () => {
    // This is the regression guard for the old broken behavior, which set
    // active=false on all other configs when a new default was picked.
    tx.pricingConfig.findUnique.mockResolvedValue({
      id: TARGET_ID,
      name: "New default",
      active: false, // intentionally false — setDefault must NOT flip this
      isDefault: false,
    });
    tx.pricingConfig.findMany.mockResolvedValue([
      { id: OTHER_DEFAULT_ID, name: "Old default" },
      { id: OTHER_NONDEFAULT_ID, name: "Bystander" }, // not actually returned since where filters isDefault:true
    ]);

    await engine.setDefault({ id: TARGET_ID, actorUserId: null });

    const updateManyCall = tx.pricingConfig.updateMany.mock.calls[0][0];
    expect(updateManyCall.data).toEqual({ isDefault: false });
    // Must NOT include `active` in the updateMany data — that was the bug.
    expect(updateManyCall.data).not.toHaveProperty("active");

    const updateCall = tx.pricingConfig.update.mock.calls[0][0];
    expect(updateCall.data).toEqual({ isDefault: true });
    // Must NOT include `active` in the update data.
    expect(updateCall.data).not.toHaveProperty("active");
  });

  it("is idempotent — calling setDefault on a config that is already the default is a no-op (besides the audit log)", async () => {
    tx.pricingConfig.findUnique.mockResolvedValue({
      id: TARGET_ID,
      name: "Already default",
      active: true,
      isDefault: true,
    });
    tx.pricingConfig.findMany.mockResolvedValue([]); // no other defaults

    await engine.setDefault({ id: TARGET_ID, actorUserId: "u_001" });

    // updateMany should still be called (it's a no-op since where matches 0 rows),
    // but update must still flip the target's isDefault to true (already true).
    expect(tx.pricingConfig.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.pricingConfig.update).toHaveBeenCalledTimes(1);
    expect(tx.pricingConfig.update.mock.calls[0][0].data).toEqual({
      isDefault: true,
    });
    // Audit log still records the action — useful for tracing who re-confirmed.
    expect(tx.adminAuditLog.create).toHaveBeenCalledTimes(1);
  });

  it("handles null actorUserId (anonymous admin action)", async () => {
    tx.pricingConfig.findUnique.mockResolvedValue({
      id: TARGET_ID,
      name: "X",
      active: true,
      isDefault: false,
    });
    tx.pricingConfig.findMany.mockResolvedValue([]);

    await engine.setDefault({ id: TARGET_ID, actorUserId: null });

    const auditCall = tx.adminAuditLog.create.mock.calls[0][0];
    expect(auditCall.data.actorUserId).toBeNull();
  });
});
