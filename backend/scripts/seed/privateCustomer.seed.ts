import { EnumCustomerCustomerType, EnumUserRoles } from "@prisma/client";
import { ensureCustomerAddress, ensureCustomerVehicle, upsertCustomerProfile, upsertUser } from "./utils";
import { Salt } from "../../src/auth/password.service";

export async function seedPrivateCustomer(bcryptSalt: Salt) {
  const user = await upsertUser({
    username: "private",
    email: "private.customer@101drivers.techbee.et",
    passwordPlain: "private",
    role: EnumUserRoles.PRIVATE_CUSTOMER,
    fullName: "Alex Private",
    phone: "+1 415 555 0123",
    bcryptSalt,
  });

  const customer = await upsertCustomerProfile({
    userId: user.id,
    customerType: EnumCustomerCustomerType.PRIVATE,
    contactName: "Alex Private",
    contactEmail: "private.customer@101drivers.techbee.et",
    contactPhone: "+1 415 555 0123",
    phone: "+1 415 555 0123",
  });

  const home = await ensureCustomerAddress({
    customerId: customer.id,
    label: "Home",
    address: "123 Market St",
    city: "San Francisco",
    state: "CA",
    postalCode: "94103",
    country: "USA",
    isDefault: true,
    lat: 37.7749,
    lng: -122.4194,
    placeId: "ChIJ-Home-Mock",
  });

  // set defaultPickupId
  await (await import("./utils")).prisma.customer.update({
    where: { id: customer.id },
    data: { defaultPickupId: home.id },
  });

  await ensureCustomerVehicle({
    customerId: customer.id,
    make: "Toyota",
    model: "Camry",
    color: "Silver",
    licensePlate: "CA-PRIV-123",
  });
}
