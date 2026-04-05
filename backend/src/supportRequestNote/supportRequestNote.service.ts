import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SupportRequestNoteServiceBase } from "./base/supportRequestNote.service.base";

@Injectable()
export class SupportRequestNoteService extends SupportRequestNoteServiceBase {
  constructor(protected readonly prisma: PrismaService) {
    super(prisma);
  }
}
