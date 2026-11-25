// Backend lifecycle-lock regression tests (Task 79 hardening).
//
// The incident these lock in: grants.json grants every role
// Driver update:any, and the old policy only validated the STATUS VALUE —
// so any authenticated user (including a suspended driver) could
// self-approve via generic PATCH /drivers/:id { status: "APPROVED" } with
// zero audit trail. The policy now makes DriverApprovalEngine the single
// status writer. Run: cd backend && npx jest driverPolicy.
import { AppException } from "../../errors/app.exception";
import { DriverPolicyService } from "./driverPolicy.service";
import { EnumDriverStatus } from "@prisma/client";

const policy = new DriverPolicyService();

const existingRow = {
  id: "driver-1",
  userId: "user-1",
  status: EnumDriverStatus.PENDING_APPROVAL,
  phone: null,
  profilePhotoUrl: null,
  approvedAt: null,
  approvedByUserId: null,
};

function prismaWith(existing: typeof existingRow | null) {
  return {
    driver: {
      findUnique: jest.fn().mockResolvedValue(existing),
    },
  } as any;
}

describe("DriverPolicyService lifecycle lock — beforeUpdate", () => {
  it("REJECTS a status change through generic update (the takeover hole)", async () => {
    await expect(
      policy.beforeUpdate(
        prismaWith(existingRow),
        "driver-1",
        { status: EnumDriverStatus.APPROVED } as any
      )
    ).rejects.toThrow(/lifecycle endpoints/);
  });

  it("REJECTS a status change even when it is a valid enum value", async () => {
    await expect(
      policy.beforeUpdate(
        prismaWith(existingRow),
        "driver-1",
        { status: EnumDriverStatus.SUSPENDED } as any
      )
    ).rejects.toThrow(AppException);
  });

  it("still allows non-lifecycle profile fields (phone, photo)", async () => {
    await expect(
      policy.beforeUpdate(
        prismaWith(existingRow),
        "driver-1",
        { phone: "+251911000000" } as any
      )
    ).resolves.toBeUndefined();
  });

  it("rejects unknown driver ids as before", async () => {
    await expect(
      policy.beforeUpdate(prismaWith(null), "missing", {} as any)
    ).rejects.toThrow(/not found/i);
  });
});

describe("DriverPolicyService lifecycle lock — beforeCreate", () => {
  it("allows creating a row born WAITLISTED", async () => {
    await expect(
      policy.beforeCreate(prismaWith(null), {
        user: { connect: { id: "user-1" } },
        status: EnumDriverStatus.WAITLISTED,
      } as any)
    ).resolves.toBeUndefined();
  });

  it("rejects an omitted status too (pre-existing contract: callers must pass WAITLISTED explicitly)", async () => {
    await expect(
      policy.beforeCreate(prismaWith(null), {
        user: { connect: { id: "user-1" } },
      } as any)
    ).rejects.toThrow(AppException);
  });

  it.each([
    EnumDriverStatus.APPROVED,
    EnumDriverStatus.SUSPENDED,
    EnumDriverStatus.REJECTED,
    EnumDriverStatus.INVITED,
    EnumDriverStatus.ON_HOLD,
  ])("REJECTS creating a row born as %s (funnel bypass)", async (status) => {
    // ON_HOLD / MEETING_REQUESTED additionally fail the value whitelist
    // before the lifecycle lock — either way creation is refused.
    await expect(
      policy.beforeCreate(prismaWith(null), {
        user: { connect: { id: "user-1" } },
        status,
      } as any)
    ).rejects.toThrow(AppException);
  });
});
