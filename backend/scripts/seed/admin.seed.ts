import { EnumUserRoles } from "@prisma/client";
import { upsertUser } from "./utils";
import { Salt } from "../../src/auth/password.service";

export async function seedAdmin(bcryptSalt: Salt) {
  await upsertUser({
    username: "admin",
    email: "admin@101drivers.techbee.et",
    passwordPlain: "admin",
    role: EnumUserRoles.ADMIN,
    fullName: "101 Drivers Admin",
    phone: "+1 415 555 0100",
    bcryptSalt,
  });
}
