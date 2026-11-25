// Backend realtime + transition-guard regression tests (Task 79 hardening).
//
// Locks in: (1) unsuspendDriver must reject non-SUSPENDED source statuses —
// previously ANY status (WAITLISTED / INVITED / REJECTED) could be flipped
// straight to APPROVED, bypassing the approval funnel; (2) every committed
// lifecycle transition emits APP_EVENT.DRIVER_STATUS_CHANGED AFTER the
// database write and audit row — the realtime sync signal the tracking
// gateway relays to the driver's user room.
// Run: cd backend && npx jest driverApproval.engine
import { BadRequestException } from "@nestjs/common";
import { APP_EVENT } from "../../common/appEvents/appEvents.service";
import { DriverApprovalEngine } from "./driverApproval.engine";
import { EnumDriverStatus, Prisma } from "@prisma/client";

function buildEngine(driverFindUnique: jest.Mock) {
  const prisma = {
    driver: { findUnique: driverFindUnique, update: jest.fn().mockResolvedValue({}) },
    adminAuditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const appEvents = { emit: jest.fn() };
  const engine = new DriverApprovalEngine(
    prisma as any,
    {} as any, // mailService — unsuspend sends no email
    {} as any, // notificationEventEngine
    {} as any, // referralTrigger
    appEvents as any
  );
  return { engine, prisma, appEvents };
}

describe("DriverApprovalEngine.unsuspendDriver", () => {
  it("REJECTS a non-suspended source status (funnel bypass hole)", async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({ id: "driver-1", status: EnumDriverStatus.WAITLISTED });
    const { engine, prisma, appEvents } = buildEngine(findUnique);

    await expect(
      engine.unsuspendDriver({ driverId: "driver-1", actorUserId: "admin-1" })
    ).rejects.toThrow(BadRequestException);

    // No mutation, no audit, no realtime ping.
    expect(prisma.driver.update).not.toHaveBeenCalled();
    expect(prisma.adminAuditLog.create).not.toHaveBeenCalled();
    expect(appEvents.emit).not.toHaveBeenCalled();
  });

  it("SUSPENDED → APPROVED commits, audits, and pings the event bus", async () => {
    const findUnique = jest
      .fn()
      // 1st call: source-status check
      .mockResolvedValueOnce({ id: "driver-1", status: EnumDriverStatus.SUSPENDED })
      // 2nd call: afterJson snapshot
      .mockResolvedValueOnce({ id: "driver-1", status: EnumDriverStatus.APPROVED })
      // 3rd call (notifyStatusChanged): owning user lookup
      .mockResolvedValueOnce({ userId: "user-1" });
    const { engine, prisma, appEvents } = buildEngine(findUnique);

    await engine.unsuspendDriver({ driverId: "driver-1", actorUserId: "admin-1" });

    expect(prisma.driver.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "driver-1" },
        data: { status: EnumDriverStatus.APPROVED },
      })
    );
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "DRIVER_UNSUSPEND",
          driverId: "driver-1",
        }),
      })
    );
    // The realtime ping fires only AFTER the audit row, and only to the
    // owning user's identity — identifiers, never authorization.
    expect(appEvents.emit).toHaveBeenCalledTimes(1);
    expect(appEvents.emit).toHaveBeenCalledWith(APP_EVENT.DRIVER_STATUS_CHANGED, {
      driverId: "driver-1",
      userId: "user-1",
      status: EnumDriverStatus.APPROVED,
      changedAt: expect.any(String),
    });
  });

  it("a ping failure NEVER fails the committed admin operation", async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({ id: "driver-1", status: EnumDriverStatus.SUSPENDED })
      .mockResolvedValueOnce({ id: "driver-1", status: EnumDriverStatus.APPROVED })
      .mockRejectedValueOnce(new Error("transient DB blip"));
    const { engine } = buildEngine(findUnique);

    await expect(
      engine.unsuspendDriver({ driverId: "driver-1", actorUserId: "admin-1" })
    ).resolves.toBeUndefined();
  });
});
