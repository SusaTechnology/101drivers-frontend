import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EmailVerificationTokenServiceBase } from "./base/emailVerificationToken.service.base";

@Injectable()
export class EmailVerificationTokenService extends EmailVerificationTokenServiceBase {
  constructor(protected readonly prisma: PrismaService) {
    super(prisma);
  }
}
