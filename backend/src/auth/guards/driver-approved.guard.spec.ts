// Backend operational-gate regression tests (Task 79 hardening).
//
// The frontend route guard is UX only — DriverApprovedGuard is the
// enforcement twin: every decorated operational endpoint re-reads the
// driver's CURRENT status from the database per request, so a suspended /
// rejected / pending driver cannot operate even with a fresh access token
// (status is deliberately NOT a JWT claim — it would go stale).
// Run: cd backend && npx jest driver-approved
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { EnumDriverStatus } from "@prisma/client";
import { DriverApprovedGuard } from "./driver-approved.guard";

function buildGuard(driver: { id: string; status: EnumDriverStatus } | null) {
  const prisma = { driver: { findFirst: jest.fn().mockResolvedValue(driver) } };
  return { guard: new DriverApprovedGuard(prisma as any), prisma };
}

function contextFor(user: any) {
  const request: any = { user };
  return {
    request,
    context: {
      switchToHttp: () => ({ getRequest: () => request }),
    } as any,
  };
}

describe("DriverApprovedGuard", () => {
  it("allows an APPROVED driver and stashes the driver row on the request", async () => {
    const { guard } = buildGuard({ id: "driver-1", status: EnumDriverStatus.APPROVED });
    const { request, context } = contextFor({ id: "user-1", roles: ["DRIVER"] });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.driver).toEqual({ id: "driver-1", status: EnumDriverStatus.APPROVED });
  });

  it.each([
    EnumDriverStatus.SUSPENDED,
    EnumDriverStatus.REJECTED,
    EnumDriverStatus.ON_HOLD,
    EnumDriverStatus.PENDING_APPROVAL,
    EnumDriverStatus.WAITLISTED,
  ])("blocks a %s driver even with a fresh token", async (status) => {
    const { guard, prisma } = buildGuard({ id: "driver-1", status });
    const { context } = contextFor({ id: "user-1", roles: ["DRIVER"] });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    // Status came from the DB read, not from any client-supplied claim.
    expect(prisma.driver.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } })
    );
  });

  it("blocks callers with NO driver profile", async () => {
    const { guard } = buildGuard(null);
    const { context } = contextFor({ id: "user-9", roles: ["DRIVER"] });
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it("rejects unauthenticated requests", async () => {
    const { guard } = buildGuard(null);
    const { context } = contextFor(undefined);
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it("ADMIN bypass: ops tooling without a driver session passes the gate", async () => {
    const { guard, prisma } = buildGuard(null);
    const { context } = contextFor({ id: "admin-1", roles: ["ADMIN"] });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.driver.findFirst).not.toHaveBeenCalled();
  });
});
