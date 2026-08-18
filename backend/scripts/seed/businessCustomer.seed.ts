//src/scripts/seed/businessCustomer.seed.ts
import { EnumCustomerCustomerType, EnumUserRoles } from "@prisma/client";
import { ensureCustomerAddress, ensureCustomerVehicle, upsertCustomerProfile, upsertUser, prisma } from "./utils";
import { Salt } from "../../src/auth/password.service";

export async function seedBusinessCustomer(bcryptSalt: Salt) {
  const user = await upsertUser({
    username: "business",
    email: "business.customer@101drivers.techbee.et",
    passwordPlain: "business",
    role: EnumUserRoles.BUSINESS_CUSTOMER,
    fullName: "Bay Auto Sales",
    phone: "+1 650 555 0199",
    bcryptSalt,
  });

  const customer = await upsertCustomerProfile({
    userId: user.id,
    customerType: EnumCustomerCustomerType.BUSINESS,
    businessName: "Bay Auto Sales LLC",
    businessPhone: "+1 650 555 0199",
    businessWebsite: "https://example.com",
    businessAddress: "500 El Camino Real",
    contactName: "Jordan Sales",
    contactEmail: "business.customer@101drivers.techbee.et",
    contactPhone: "+1 650 555 0199",
    phone: "+1 650 555 0199",
  });

  // NOTE: postpaidEnabled is intentionally NOT set to true here.
  // Setting it to true without also calling
  // PostpaidBillingService.setupDealerForPostpaid() leaves the dealer in an
  // illegal half-configured state (postpaid flag on, but no Stripe Customer /
  // Subscription / saved PM, billingMode null) and any postpaid delivery
  // attempt against them will be rejected by canDealerCreateDelivery with
  // reason NO_SUBSCRIPTION.
  //
  // To seed a fully-functional postpaid dealer you must (in this order):
  //   1. Set STRIPE_SECRET_KEY + STRIPE_POSTPAID_PRICE_ID in the env.
  //   2. Uncomment the update below to flip the flag.
  //   3. After seeding, call:
  //        POST /api/postpaid-billing/dealers/<customerId>/setup
  //      (admin auth required) to create the Stripe Customer + anchor
  //      Subscription and persist stripeCustomerId / stripeSubscriptionId
  //      on the Customer row.
  //   4. Have the dealer save a card via /api/payments/stripe/save-card so
  //      stripeDefaultPaymentMethodId gets set (otherwise the first weekly
  //      invoice will fail and freeze the dealer).
  //
  // await prisma.customer.update({
  //   where: { id: customer.id },
  //   data: { postpaidEnabled: true },
  // });

  const lot = await ensureCustomerAddress({
    customerId: customer.id,
    label: "Main Lot",
    address: "500 El Camino Real",
    city: "San Mateo",
    state: "CA",
    postalCode: "94401",
    country: "USA",
    isDefault: true,
    lat: 37.5630,
    lng: -122.3255,
    placeId: "ChIJ-Lot-Mock",
  });

  await prisma.customer.update({
    where: { id: customer.id },
    data: { defaultPickupId: lot.id },
  });

  await ensureCustomerVehicle({
    customerId: customer.id,
    make: "Ford",
    model: "F-150",
    color: "Black",
    licensePlate: "CA-BIZ-777",
  });
}
