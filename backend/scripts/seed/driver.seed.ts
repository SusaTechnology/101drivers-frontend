// src/scripts/seed/driver.seed.ts
import { EnumUserRoles } from "@prisma/client";
import { upsertDriverProfile, upsertUser } from "./utils";
import { Salt } from "../../src/auth/password.service";

export async function seedDriver(bcryptSalt: Salt) {
  const user = await upsertUser({
    username: "driver",
    email: "driver@101drivers.techbee.et",
    passwordPlain: "driver",
    role: EnumUserRoles.DRIVER,
    fullName: "Chris Driver",
    phone: "+1 408 555 0144",
    bcryptSalt,
  });

  await upsertDriverProfile({
    userId: user.id,
    phone: "+1 408 555 0144",
    profilePhotoUrl: "https://picsum.photos/seed/101drivers-driver/300/300",
  });
}
