import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

type DbClient = any;

@Injectable()
export class UserPolicyService {
  async beforeCreate(
    tx: DbClient,
    data: Prisma.UserCreateArgs["data"]
  ): Promise<void> {
    const email = this.readValue(data.email);
    const username = this.readValue((data as any).username);

    if (!email || typeof email !== "string") {
      throw new BadRequestException("email is required");
    }

    await this.ensureUniqueEmail(tx, email);

    if (username && typeof username === "string") {
      await this.ensureUniqueUsername(tx, username);
    }

    this.validateDisabledState(
      this.readValue((data as any).disabledAt),
      this.readValue((data as any).disabledReason)
    );
  }

  async beforeUpdate(
    tx: DbClient,
    id: string,
    data: Prisma.UserUpdateArgs["data"]
  ): Promise<void> {
    const email = this.readValue((data as any).email);
    const username = this.readValue((data as any).username);
    const disabledAt = this.readValue((data as any).disabledAt);
    const disabledReason = this.readValue((data as any).disabledReason);

    if (email && typeof email === "string") {
      await this.ensureUniqueEmail(tx, email, id);
    }

    if (username && typeof username === "string") {
      await this.ensureUniqueUsername(tx, username, id);
    }

    this.validateDisabledState(disabledAt, disabledReason);
  }

  async beforeDelete(tx: DbClient, id: string): Promise<void> {
    const existing = await tx.user.findUnique({
      where: { id },
      select: {
        id: true,
        customer: { select: { id: true } },
        driver: { select: { id: true } },
        _count: {
          select: {
            deliveriesCreated: true,
            assignmentsMade: true,
            adminActions: true,
            notifEvents: true,
            statusActions: true,
            scheduleChangesRequested: true,
            scheduleChangesDecided: true,
          },
        },
      },
    });

    if (!existing) {
      throw new BadRequestException("User not found");
    }

    const hasDependencies =
      !!existing.customer ||
      !!existing.driver ||
      existing._count.deliveriesCreated > 0 ||
      existing._count.assignmentsMade > 0 ||
      existing._count.adminActions > 0 ||
      existing._count.notifEvents > 0 ||
      existing._count.statusActions > 0 ||
      existing._count.scheduleChangesRequested > 0 ||
      existing._count.scheduleChangesDecided > 0;

    if (hasDependencies) {
      throw new BadRequestException(
        "User cannot be deleted because related records exist"
      );
    }
  }

  private async ensureUniqueEmail(
    tx: DbClient,
    email: string,
    excludeId?: string
  ): Promise<void> {
    const existing = await tx.user.findFirst({
      where: {
        email,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException("email already exists");
    }
  }

  private async ensureUniqueUsername(
    tx: DbClient,
    username: string,
    excludeId?: string
  ): Promise<void> {
    const existing = await tx.user.findFirst({
      where: {
        username,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException("username already exists");
    }
  }

  private validateDisabledState(
    disabledAt: unknown,
    disabledReason: unknown
  ): void {
    if (disabledReason && !disabledAt) {
      throw new BadRequestException(
        "disabledReason cannot be set without disabledAt"
      );
    }
  }

  private readValue(value: any): any {
    if (value && typeof value === "object" && "set" in value) {
      return value.set;
    }
    return value;
  }
}