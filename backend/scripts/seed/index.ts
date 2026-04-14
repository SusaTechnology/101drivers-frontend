import {
  EnumAdminAuditLogAction,
  EnumAdminAuditLogActorType,
  EnumCustomerApprovalStatus,
  EnumCustomerCustomerType,
  EnumDeliveryEvidencePhase,
  EnumDeliveryEvidenceType,
  EnumDeliveryRatingTarget,
  EnumDeliveryRequestCreatedByRole,
  EnumDeliveryRequestCustomerChose,
  EnumDeliveryRequestServiceType,
  EnumDeliveryRequestStatus,
  EnumDeliveryStatusHistoryActorRole,
  EnumDeliveryStatusHistoryActorType,
  EnumDeliveryStatusHistoryFromStatus,
  EnumDeliveryStatusHistoryToStatus,
  EnumDisputeCaseStatus,
  EnumDriverPayoutStatus,
  EnumDriverStatus,
  EnumNotificationEventChannel,
  EnumNotificationEventStatus,
  EnumNotificationEventType,
  EnumPaymentEventStatus,
  EnumPaymentEventType,
  EnumPaymentPaymentType,
  EnumPaymentProvider,
  EnumPaymentStatus,
  EnumPricingCategoryRuleCategory,
  EnumPricingConfigPricingMode,
  EnumQuoteMileageCategory,
  EnumQuotePricingMode,
  EnumQuoteServiceType,
  EnumScheduleChangeRequestRequestedByRole,
  EnumScheduleChangeRequestStatus,
  EnumSchedulingPolicyCustomerType,
  EnumSchedulingPolicyDefaultMode,
  EnumSchedulingPolicyServiceType,
  EnumTipProvider,
  EnumTipStatus,
  EnumTrackingSessionStatus,
  EnumUserRoles,
} from "@prisma/client";
import { Salt } from "../../src/auth/password.service";
import { seedAdmin } from "./admin.seed";
import { seedPrivateCustomer } from "./privateCustomer.seed";
import { seedBusinessCustomer } from "./businessCustomer.seed";
import { seedDriver } from "./driver.seed";
import {
  ensureCustomerAddress,
  ensureCustomerVehicle,
  prisma,
  upsertCustomerProfile,
  upsertDriverProfile,
  upsertUser,
} from "./utils";

type DemoRefs = {
  adminUserId: string;
  privateUserId: string;
  privateCustomerId: string;
  businessUserId: string;
  businessCustomerId: string;
  business2UserId: string;
  business2CustomerId: string;
  driver1UserId: string;
  driver1Id: string;
  driver2UserId: string;
  driver2Id: string;
  driver3UserId: string;
  driver3Id: string;
  pricingConfigId: string;
  westsideDistrictId: string;
  pasadenaDistrictId: string;
  midtownDistrictId: string;
  southBayDistrictId: string;
  greaterLaDistrictId: string;
};

export async function seedAll(bcryptSalt: Salt) {
  await seedAdmin(bcryptSalt);
  await seedPrivateCustomer(bcryptSalt);
  await seedBusinessCustomer(bcryptSalt);
  await seedDriver(bcryptSalt);

  const refs = await seedCoreDemoActors(bcryptSalt);
  await seedConfiguration(refs);
  await seedLeads();
  await seedDemoDeliveries(refs);
}

async function seedCoreDemoActors(bcryptSalt: Salt): Promise<DemoRefs> {
  const adminUser = await prisma.user.findUniqueOrThrow({
    where: { username: "admin" },
  });

  const privateUser = await prisma.user.findUniqueOrThrow({
    where: { username: "private" },
  });

  const privateCustomer = await prisma.customer.findUniqueOrThrow({
    where: { userId: privateUser.id },
  });

  const businessUser = await prisma.user.findUniqueOrThrow({
    where: { username: "business" },
  });

  const businessCustomer = await prisma.customer.findUniqueOrThrow({
    where: { userId: businessUser.id },
  });

  const driver1User = await prisma.user.findUniqueOrThrow({
    where: { username: "driver" },
  });

  const driver1 = await prisma.driver.findUniqueOrThrow({
    where: { userId: driver1User.id },
  });

  const business2User = await upsertUser({
    username: "dealer2",
    email: "dealer2@101drivers.techbee.et",
    passwordPlain: "dealer2",
    role: EnumUserRoles.BUSINESS_CUSTOMER,
    fullName: "Golden Gate Auto Group",
    phone: "+1 510 555 0177",
    bcryptSalt,
  });

  const business2Customer = await upsertCustomerProfile({
    userId: business2User.id,
    customerType: EnumCustomerCustomerType.BUSINESS,
    businessName: "Golden Gate Auto Group",
    businessPhone: "+1 510 555 0177",
    businessWebsite: "https://goldengate-auto.demo",
    businessAddress: "2400 Broadway",
    contactName: "Maya Dealer",
    contactEmail: "dealer2@101drivers.techbee.et",
    contactPhone: "+1 510 555 0177",
    phone: "+1 510 555 0177",
  });

  const driver2User = await upsertUser({
    username: "driver2",
    email: "driver2@101drivers.techbee.et",
    passwordPlain: "driver2",
    role: EnumUserRoles.DRIVER,
    fullName: "Taylor Driver",
    phone: "+1 650 555 0102",
    bcryptSalt,
  });

  const driver2 = await upsertDriverProfile({
    userId: driver2User.id,
    phone: "+1 650 555 0102",
    profilePhotoUrl: "https://picsum.photos/seed/101drivers-driver2/300/300",
  });

  const driver3User = await upsertUser({
    username: "driver3",
    email: "driver3@101drivers.techbee.et",
    passwordPlain: "driver3",
    role: EnumUserRoles.DRIVER,
    fullName: "Jordan Haul",
    phone: "+1 415 555 0103",
    bcryptSalt,
  });

  const driver3 = await upsertDriverProfile({
    userId: driver3User.id,
    phone: "+1 415 555 0103",
    profilePhotoUrl: "https://picsum.photos/seed/101drivers-driver3/300/300",
  });

  await approveCustomer(privateCustomer.id, adminUser.id);
  await approveCustomer(businessCustomer.id, adminUser.id);
  await approveCustomer(business2Customer.id, adminUser.id);

  await approveDriver(driver1.id, adminUser.id);
  await approveDriver(driver2.id, adminUser.id);
  await approveDriver(driver3.id, adminUser.id);

  const privateHome = await ensureCustomerAddress({
    customerId: privateCustomer.id,
    label: "Home",
    address: "1600 Amphitheatre Parkway",
    city: "Mountain View",
    state: "CA",
    postalCode: "94043",
    country: "USA",
    isDefault: true,
    lat: 37.422,
    lng: -122.0841,
    placeId: "demo-private-home",
  });

  await prisma.customer.update({
    where: { id: privateCustomer.id },
    data: { defaultPickupId: privateHome.id },
  });

  await ensureCustomerVehicle({
    customerId: privateCustomer.id,
    make: "Honda",
    model: "Civic",
    color: "Blue",
    licensePlate: "CA-PRI-101",
  });

  const businessLot = await ensureCustomerAddress({
    customerId: businessCustomer.id,
    label: "Main Lot",
    address: "500 El Camino Real",
    city: "San Mateo",
    state: "CA",
    postalCode: "94401",
    country: "USA",
    isDefault: true,
    lat: 37.563,
    lng: -122.3255,
    placeId: "demo-business-main-lot",
  });

  await prisma.customer.update({
    where: { id: businessCustomer.id },
    data: {
      defaultPickupId: businessLot.id,
      postpaidEnabled: true,
    },
  });

  await ensureCustomerVehicle({
    customerId: businessCustomer.id,
    make: "Ford",
    model: "F-150",
    color: "Black",
    licensePlate: "CA-BIZ-777",
  });

  const business2Lot = await ensureCustomerAddress({
    customerId: business2Customer.id,
    label: "Oakland Lot",
    address: "2400 Broadway",
    city: "Oakland",
    state: "CA",
    postalCode: "94612",
    country: "USA",
    isDefault: true,
    lat: 37.8113,
    lng: -122.2687,
    placeId: "demo-business2-main-lot",
  });

  await prisma.customer.update({
    where: { id: business2Customer.id },
    data: {
      defaultPickupId: business2Lot.id,
      postpaidEnabled: true,
    },
  });

  await ensureCustomerVehicle({
    customerId: business2Customer.id,
    make: "Tesla",
    model: "Model 3",
    color: "White",
    licensePlate: "CA-GGA-303",
  });

  const westsideDistrict = await prisma.serviceDistrict.upsert({
    where: { code: "WESTSIDE" },
    update: {
      name: "West Side LA",
      active: true,
      geoJson: {
        type: "Feature",
        properties: { type: "pickup_zone", zone: "West Side LA" },
        geometry: {
          type: "Polygon",
          coordinates: [[[-118.52, 34.02], [-118.40, 34.02], [-118.40, 34.08], [-118.52, 34.08], [-118.52, 34.02]]],
        },
      },
    },
    create: {
      code: "WESTSIDE",
      name: "West Side LA",
      active: true,
      geoJson: {
        type: "Feature",
        properties: { type: "pickup_zone", zone: "West Side LA" },
        geometry: {
          type: "Polygon",
          coordinates: [[[-118.52, 34.02], [-118.40, 34.02], [-118.40, 34.08], [-118.52, 34.08], [-118.52, 34.02]]],
        },
      },
    },
  });

  const pasadenaDistrict = await prisma.serviceDistrict.upsert({
    where: { code: "PASADENA" },
    update: {
      name: "Pasadena",
      active: true,
      geoJson: {
        type: "Feature",
        properties: { type: "pickup_zone", zone: "Pasadena" },
        geometry: {
          type: "Polygon",
          coordinates: [[[-118.18, 34.13], [-118.08, 34.13], [-118.08, 34.22], [-118.18, 34.22], [-118.18, 34.13]]],
        },
      },
    },
    create: {
      code: "PASADENA",
      name: "Pasadena",
      active: true,
      geoJson: {
        type: "Feature",
        properties: { type: "pickup_zone", zone: "Pasadena" },
        geometry: {
          type: "Polygon",
          coordinates: [[[-118.18, 34.13], [-118.08, 34.13], [-118.08, 34.22], [-118.18, 34.22], [-118.18, 34.13]]],
        },
      },
    },
  });

  const midtownDistrict = await prisma.serviceDistrict.upsert({
    where: { code: "MIDTOWN" },
    update: {
      name: "Midtown LA",
      active: true,
      geoJson: {
        type: "Feature",
        properties: { type: "pickup_zone", zone: "Midtown LA" },
        geometry: {
          type: "Polygon",
          coordinates: [[[-118.35, 34.04], [-118.25, 34.04], [-118.25, 34.10], [-118.35, 34.10], [-118.35, 34.04]]],
        },
      },
    },
    create: {
      code: "MIDTOWN",
      name: "Midtown LA",
      active: true,
      geoJson: {
        type: "Feature",
        properties: { type: "pickup_zone", zone: "Midtown LA" },
        geometry: {
          type: "Polygon",
          coordinates: [[[-118.35, 34.04], [-118.25, 34.04], [-118.25, 34.10], [-118.35, 34.10], [-118.35, 34.04]]],
        },
      },
    },
  });

  const southBayDistrict = await prisma.serviceDistrict.upsert({
    where: { code: "SOUTH_BAY" },
    update: {
      name: "South Bay",
      active: true,
      geoJson: {
        type: "Feature",
        properties: { type: "pickup_zone", zone: "South Bay" },
        geometry: {
          type: "Polygon",
          coordinates: [[[-118.42, 33.82], [-118.33, 33.82], [-118.33, 33.90], [-118.42, 33.90], [-118.42, 33.82]]],
        },
      },
    },
    create: {
      code: "SOUTH_BAY",
      name: "South Bay",
      active: true,
      geoJson: {
        type: "Feature",
        properties: { type: "pickup_zone", zone: "South Bay" },
        geometry: {
          type: "Polygon",
          coordinates: [[[-118.42, 33.82], [-118.33, 33.82], [-118.33, 33.90], [-118.42, 33.90], [-118.42, 33.82]]],
        },
      },
    },
  });

  const greaterLaDistrict = await prisma.serviceDistrict.upsert({
    where: { code: "GREATER_LA" },
    update: {
      name: "Greater LA Core",
      active: true,
      geoJson: {
        type: "Feature",
        properties: { type: "pickup_zone", zone: "Greater LA Core" },
        geometry: {
          type: "Polygon",
          coordinates: [[[-118.35, 33.90], [-118.20, 33.90], [-118.20, 34.10], [-118.35, 34.10], [-118.35, 33.90]]],
        },
      },
    },
    create: {
      code: "GREATER_LA",
      name: "Greater LA Core",
      active: true,
      geoJson: {
        type: "Feature",
        properties: { type: "pickup_zone", zone: "Greater LA Core" },
        geometry: {
          type: "Polygon",
          coordinates: [[[-118.35, 33.90], [-118.20, 33.90], [-118.20, 34.10], [-118.35, 34.10], [-118.35, 33.90]]],
        },
      },
    },
  });

  await ensureDriverPreferences(driver1.id, {
    city: "Santa Monica",
    radiusMiles: 40,
    districts: [westsideDistrict.id, midtownDistrict.id, greaterLaDistrict.id],
    emailEnabled: true,
    smsEnabled: true,
  });

  await ensureDriverPreferences(driver2.id, {
    city: "Torrance",
    radiusMiles: 50,
    districts: [southBayDistrict.id, greaterLaDistrict.id],
    emailEnabled: true,
    smsEnabled: false,
  });

  await ensureDriverPreferences(driver3.id, {
    city: "Pasadena",
    radiusMiles: 45,
    districts: [pasadenaDistrict.id, midtownDistrict.id],
    emailEnabled: true,
    smsEnabled: true,
  });

  const pricingConfig = await ensurePricingConfiguration();

  return {
    adminUserId: adminUser.id,
    privateUserId: privateUser.id,
    privateCustomerId: privateCustomer.id,
    businessUserId: businessUser.id,
    businessCustomerId: businessCustomer.id,
    business2UserId: business2User.id,
    business2CustomerId: business2Customer.id,
    driver1UserId: driver1User.id,
    driver1Id: driver1.id,
    driver2UserId: driver2User.id,
    driver2Id: driver2.id,
    driver3UserId: driver3User.id,
    driver3Id: driver3.id,
    pricingConfigId: pricingConfig.id,
    westsideDistrictId: westsideDistrict.id,
    pasadenaDistrictId: pasadenaDistrict.id,
    midtownDistrictId: midtownDistrict.id,
    southBayDistrictId: southBayDistrict.id,
    greaterLaDistrictId: greaterLaDistrict.id,
  };
}

async function seedConfiguration(refs: DemoRefs) {
  await prisma.customer.updateMany({
    where: { id: { in: [refs.privateCustomerId, refs.businessCustomerId, refs.business2CustomerId] } },
    data: {
      pricingConfigId: refs.pricingConfigId,
    },
  });

  const schedulingPolicies = [
    {
      customerType: EnumSchedulingPolicyCustomerType.PRIVATE,
      serviceType: EnumSchedulingPolicyServiceType.HOME_DELIVERY,
      bufferMinutes: 30,
      maxSameDayMiles: 90,
      afterHoursEnabled: false,
      requiresOpsConfirmation: false,
      defaultMode: EnumSchedulingPolicyDefaultMode.NEXT_DAY,
      sameDayCutoffTime: "14:00",
    },
    {
      customerType: EnumSchedulingPolicyCustomerType.BUSINESS,
      serviceType: EnumSchedulingPolicyServiceType.HOME_DELIVERY,
      bufferMinutes: 25,
      maxSameDayMiles: 120,
      afterHoursEnabled: true,
      requiresOpsConfirmation: false,
      defaultMode: EnumSchedulingPolicyDefaultMode.SAME_DAY,
      sameDayCutoffTime: "16:00",
    },
    {
      customerType: EnumSchedulingPolicyCustomerType.BUSINESS,
      serviceType: EnumSchedulingPolicyServiceType.BETWEEN_LOCATIONS,
      bufferMinutes: 30,
      maxSameDayMiles: 140,
      afterHoursEnabled: true,
      requiresOpsConfirmation: false,
      defaultMode: EnumSchedulingPolicyDefaultMode.SAME_DAY,
      sameDayCutoffTime: "16:30",
    },
    {
      customerType: EnumSchedulingPolicyCustomerType.PRIVATE,
      serviceType: EnumSchedulingPolicyServiceType.SERVICE_PICKUP_RETURN,
      bufferMinutes: 45,
      maxSameDayMiles: 70,
      afterHoursEnabled: false,
      requiresOpsConfirmation: true,
      defaultMode: EnumSchedulingPolicyDefaultMode.NEXT_DAY,
      sameDayCutoffTime: "12:00",
    },
  ];

  for (const item of schedulingPolicies) {
    const existing = await prisma.schedulingPolicy.findFirst({
      where: {
        customerType: item.customerType,
        serviceType: item.serviceType,
      },
    });

    if (existing) {
      await prisma.schedulingPolicy.update({
        where: { id: existing.id },
        data: {
          active: true,
          bufferMinutes: item.bufferMinutes,
          maxSameDayMiles: item.maxSameDayMiles,
          afterHoursEnabled: item.afterHoursEnabled,
          requiresOpsConfirmation: item.requiresOpsConfirmation,
          defaultMode: item.defaultMode,
          sameDayCutoffTime: item.sameDayCutoffTime,
        },
      });
    } else {
      await prisma.schedulingPolicy.create({
        data: {
          active: true,
          customerType: item.customerType,
          serviceType: item.serviceType,
          bufferMinutes: item.bufferMinutes,
          maxSameDayMiles: item.maxSameDayMiles,
          afterHoursEnabled: item.afterHoursEnabled,
          requiresOpsConfirmation: item.requiresOpsConfirmation,
          defaultMode: item.defaultMode,
          sameDayCutoffTime: item.sameDayCutoffTime,
        },
      });
    }
  }

  // ── Seed operating hours (Mon–Sun, 08:00–20:00) ──────────────────────────
  for (let day = 1; day <= 7; day++) {
    await prisma.operatingHour.upsert({
      where: { id: `seed-oh-${day}` },
      update: { active: true, startTime: "08:00", endTime: "20:00" },
      create: {
        id: `seed-oh-${day}`,
        dayOfWeek: day,
        startTime: "08:00",
        endTime: "20:00",
        active: true,
      },
    });
  }

  // ── Seed time-slot templates ──────────────────────────────────────────────
  const defaultSlotTemplates = [
    { label: "8:00 AM – 10:00 AM", startTime: "08:00", endTime: "10:00" },
    { label: "10:00 AM – 12:00 PM", startTime: "10:00", endTime: "12:00" },
    { label: "12:00 PM – 2:00 PM", startTime: "12:00", endTime: "14:00" },
    { label: "2:00 PM – 4:00 PM", startTime: "14:00", endTime: "16:00" },
    { label: "4:00 PM – 6:00 PM", startTime: "16:00", endTime: "18:00" },
    { label: "6:00 PM – 8:00 PM", startTime: "18:00", endTime: "20:00" },
  ];

  for (const tpl of defaultSlotTemplates) {
    await prisma.timeSlotTemplate.upsert({
      where: { id: `seed-tst-${tpl.startTime}` },
      update: { active: true, startTime: tpl.startTime, endTime: tpl.endTime, label: tpl.label },
      create: {
        id: `seed-tst-${tpl.startTime}`,
        label: tpl.label,
        startTime: tpl.startTime,
        endTime: tpl.endTime,
        active: true,
      },
    });
  }

  await prisma.appSetting.upsert({
    where: { key: "platform.demoMode" },
    update: {
      value: { enabled: true },
    },
    create: {
      key: "platform.demoMode",
      value: { enabled: true },
    },
  });

  await prisma.appSetting.upsert({
    where: { key: "tracking.shareLinkTtlHours" },
    update: {
      value: { hours: 72 },
    },
    create: {
      key: "tracking.shareLinkTtlHours",
      value: { hours: 72 },
    },
  });

  await prisma.appSetting.upsert({
    where: { key: "delivery.defaultBufferMinutes" },
    update: {
      value: { minutes: 30 },
    },
    create: {
      key: "delivery.defaultBufferMinutes",
      value: { minutes: 30 },
    },
  });
}

async function seedLeads() {
  await upsertDealerLead({
    email: "dealer.lead@example.com",
    businessName: "Sunset Cars",
    phone: "+1 213 555 0188",
    message: "Interested in onboarding our dealership to 101 Drivers.",
  });

  await upsertInvestorLead({
    name: "Demo Investor",
    email: "investor@example.com",
    message: "Interested in demo and growth metrics.",
  });
}

async function seedDemoDeliveries(refs: DemoRefs) {
  const now = new Date();

  const quoted = await ensureDemoDelivery({
    slug: "demo-quoted",
    customerId: refs.privateCustomerId,
    createdByUserId: refs.privateUserId,
    createdByRole: EnumDeliveryRequestCreatedByRole.PRIVATE_CUSTOMER,
    customerChose: EnumDeliveryRequestCustomerChose.PICKUP_WINDOW,
    serviceType: EnumDeliveryRequestServiceType.HOME_DELIVERY,
    quoteServiceType: EnumQuoteServiceType.HOME_DELIVERY,
    status: EnumDeliveryRequestStatus.QUOTED,
    pickupAddress: "1600 Amphitheatre Parkway, Mountain View, CA",
    pickupCity: "Mountain View",
    pickupLat: 37.422,
    pickupLng: -122.0841,
    pickupPlaceId: "demo-quoted-pickup",
    dropoffAddress: "1 Infinite Loop, Cupertino, CA",
    dropoffCity: "Cupertino",
    dropoffLat: 37.3318,
    dropoffLng: -122.0312,
    dropoffPlaceId: "demo-quoted-dropoff",
    pickupWindowStart: addHours(now, 6),
    pickupWindowEnd: addHours(now, 8),
    dropoffWindowStart: addHours(now, 9),
    dropoffWindowEnd: addHours(now, 12),
    licensePlate: "CA-QTD-101",
    vehicleColor: "Blue",
    vehicleMake: "Honda",
    vehicleModel: "Accord",
    vinVerificationCode: "1234",
    recipientName: "Quoted Customer",
    recipientEmail: "quoted.customer@example.com",
    recipientPhone: "+1 650 555 0101",
    etaMinutes: 52,
    bufferMinutes: 30,
    sameDayEligible: true,
    requiresOpsConfirmation: false,
    isUrgent: false,
    price: 185,
    distanceMiles: 33,
    pricingMode: EnumQuotePricingMode.PER_MILE,
    mileageCategory: EnumQuoteMileageCategory.B,
    trackingToken: "demo-quoted-token",
  });

  const listed = await ensureDemoDelivery({
    slug: "demo-listed",
    customerId: refs.businessCustomerId,
    createdByUserId: refs.businessUserId,
    createdByRole: EnumDeliveryRequestCreatedByRole.BUSINESS_CUSTOMER,
    customerChose: EnumDeliveryRequestCustomerChose.PICKUP_WINDOW,
    serviceType: EnumDeliveryRequestServiceType.BETWEEN_LOCATIONS,
    quoteServiceType: EnumQuoteServiceType.BETWEEN_LOCATIONS,
    status: EnumDeliveryRequestStatus.LISTED,
    pickupAddress: "500 El Camino Real, San Mateo, CA",
    pickupCity: "San Mateo",
    pickupLat: 37.563,
    pickupLng: -122.3255,
    pickupPlaceId: "demo-listed-pickup",
    dropoffAddress: "700 Airport Blvd, Burlingame, CA",
    dropoffCity: "Burlingame",
    dropoffLat: 37.5891,
    dropoffLng: -122.3477,
    dropoffPlaceId: "demo-listed-dropoff",
    pickupWindowStart: addHours(now, 3),
    pickupWindowEnd: addHours(now, 4),
    dropoffWindowStart: addHours(now, 5),
    dropoffWindowEnd: addHours(now, 7),
    licensePlate: "CA-LST-201",
    vehicleColor: "Black",
    vehicleMake: "Ford",
    vehicleModel: "F-150",
    vinVerificationCode: "2222",
    recipientName: "Lot Receiver",
    recipientEmail: "receiver@bayautosales.demo",
    recipientPhone: "+1 650 555 1111",
    etaMinutes: 28,
    bufferMinutes: 25,
    sameDayEligible: true,
    requiresOpsConfirmation: false,
    isUrgent: false,
    price: 95,
    distanceMiles: 12,
    pricingMode: EnumQuotePricingMode.FLAT_TIER,
    mileageCategory: EnumQuoteMileageCategory.A,
    trackingToken: "demo-listed-token",
  });

  const booked = await ensureDemoDelivery({
    slug: "demo-booked",
    customerId: refs.business2CustomerId,
    createdByUserId: refs.business2UserId,
    createdByRole: EnumDeliveryRequestCreatedByRole.BUSINESS_CUSTOMER,
    customerChose: EnumDeliveryRequestCustomerChose.DROPOFF_WINDOW,
    serviceType: EnumDeliveryRequestServiceType.HOME_DELIVERY,
    quoteServiceType: EnumQuoteServiceType.HOME_DELIVERY,
    status: EnumDeliveryRequestStatus.BOOKED,
    pickupAddress: "2400 Broadway, Oakland, CA",
    pickupCity: "Oakland",
    pickupLat: 37.8113,
    pickupLng: -122.2687,
    pickupPlaceId: "demo-booked-pickup",
    dropoffAddress: "1000 Marina Blvd, Brisbane, CA",
    dropoffCity: "Brisbane",
    dropoffLat: 37.6808,
    dropoffLng: -122.389,
    dropoffPlaceId: "demo-booked-dropoff",
    pickupWindowStart: addHours(now, 2),
    pickupWindowEnd: addHours(now, 3),
    dropoffWindowStart: addHours(now, 4),
    dropoffWindowEnd: addHours(now, 6),
    licensePlate: "CA-BKD-301",
    vehicleColor: "White",
    vehicleMake: "Tesla",
    vehicleModel: "Model 3",
    vinVerificationCode: "3333",
    recipientName: "Booked Receiver",
    recipientEmail: "booked.receiver@example.com",
    recipientPhone: "+1 415 555 0202",
    etaMinutes: 49,
    bufferMinutes: 30,
    sameDayEligible: true,
    requiresOpsConfirmation: false,
    isUrgent: true,
    urgentBonusAmount: 25,
    price: 210,
    distanceMiles: 27,
    pricingMode: EnumQuotePricingMode.CATEGORY_ABC,
    mileageCategory: EnumQuoteMileageCategory.B,
    trackingToken: "demo-booked-token",
  });

  const active = await ensureDemoDelivery({
    slug: "demo-active",
    customerId: refs.privateCustomerId,
    createdByUserId: refs.privateUserId,
    createdByRole: EnumDeliveryRequestCreatedByRole.PRIVATE_CUSTOMER,
    customerChose: EnumDeliveryRequestCustomerChose.PICKUP_WINDOW,
    serviceType: EnumDeliveryRequestServiceType.SERVICE_PICKUP_RETURN,
    quoteServiceType: EnumQuoteServiceType.SERVICE_PICKUP_RETURN,
    status: EnumDeliveryRequestStatus.ACTIVE,
    pickupAddress: "2200 Geng Rd, Palo Alto, CA",
    pickupCity: "Palo Alto",
    pickupLat: 37.4526,
    pickupLng: -122.1189,
    pickupPlaceId: "demo-active-pickup",
    dropoffAddress: "3333 De La Cruz Blvd, Santa Clara, CA",
    dropoffCity: "Santa Clara",
    dropoffLat: 37.3833,
    dropoffLng: -121.9636,
    dropoffPlaceId: "demo-active-dropoff",
    pickupWindowStart: addHours(now, -1),
    pickupWindowEnd: addMinutes(now, -30),
    dropoffWindowStart: addHours(now, 1),
    dropoffWindowEnd: addHours(now, 3),
    licensePlate: "CA-ACT-401",
    vehicleColor: "Silver",
    vehicleMake: "Toyota",
    vehicleModel: "Camry",
    vinVerificationCode: "4444",
    recipientName: "Service Center",
    recipientEmail: "service.center@example.com",
    recipientPhone: "+1 408 555 0303",
    etaMinutes: 55,
    bufferMinutes: 45,
    sameDayEligible: true,
    requiresOpsConfirmation: true,
    isUrgent: false,
    price: 240,
    distanceMiles: 31,
    pricingMode: EnumQuotePricingMode.PER_MILE,
    mileageCategory: EnumQuoteMileageCategory.B,
    trackingToken: "demo-active-token",
  });

  const completed = await ensureDemoDelivery({
    slug: "demo-completed",
    customerId: refs.businessCustomerId,
    createdByUserId: refs.businessUserId,
    createdByRole: EnumDeliveryRequestCreatedByRole.BUSINESS_CUSTOMER,
    customerChose: EnumDeliveryRequestCustomerChose.DROPOFF_WINDOW,
    serviceType: EnumDeliveryRequestServiceType.BETWEEN_LOCATIONS,
    quoteServiceType: EnumQuoteServiceType.BETWEEN_LOCATIONS,
    status: EnumDeliveryRequestStatus.COMPLETED,
    pickupAddress: "500 El Camino Real, San Mateo, CA",
    pickupCity: "San Mateo",
    pickupLat: 37.563,
    pickupLng: -122.3255,
    pickupPlaceId: "demo-completed-pickup",
    dropoffAddress: "10 South Van Ness Ave, San Francisco, CA",
    dropoffCity: "San Francisco",
    dropoffLat: 37.7752,
    dropoffLng: -122.4193,
    dropoffPlaceId: "demo-completed-dropoff",
    pickupWindowStart: addDays(now, -2),
    pickupWindowEnd: addDays(now, -2, 1),
    dropoffWindowStart: addDays(now, -2, 2),
    dropoffWindowEnd: addDays(now, -2, 5),
    licensePlate: "CA-CMP-501",
    vehicleColor: "Red",
    vehicleMake: "Nissan",
    vehicleModel: "Altima",
    vinVerificationCode: "5555",
    recipientName: "Completed Receiver",
    recipientEmail: "completed.receiver@example.com",
    recipientPhone: "+1 415 555 0404",
    etaMinutes: 65,
    bufferMinutes: 30,
    sameDayEligible: true,
    requiresOpsConfirmation: false,
    isUrgent: false,
    price: 275,
    distanceMiles: 36,
    pricingMode: EnumQuotePricingMode.CATEGORY_ABC,
    mileageCategory: EnumQuoteMileageCategory.B,
    trackingToken: "demo-completed-token",
  });

  const cancelled = await ensureDemoDelivery({
    slug: "demo-cancelled",
    customerId: refs.privateCustomerId,
    createdByUserId: refs.privateUserId,
    createdByRole: EnumDeliveryRequestCreatedByRole.PRIVATE_CUSTOMER,
    customerChose: EnumDeliveryRequestCustomerChose.PICKUP_WINDOW,
    serviceType: EnumDeliveryRequestServiceType.HOME_DELIVERY,
    quoteServiceType: EnumQuoteServiceType.HOME_DELIVERY,
    status: EnumDeliveryRequestStatus.CANCELLED,
    pickupAddress: "1 Market St, San Francisco, CA",
    pickupCity: "San Francisco",
    pickupLat: 37.7946,
    pickupLng: -122.3944,
    pickupPlaceId: "demo-cancelled-pickup",
    dropoffAddress: "4 Embarcadero Center, San Francisco, CA",
    dropoffCity: "San Francisco",
    dropoffLat: 37.7955,
    dropoffLng: -122.3962,
    dropoffPlaceId: "demo-cancelled-dropoff",
    pickupWindowStart: addDays(now, -1),
    pickupWindowEnd: addDays(now, -1, 1),
    dropoffWindowStart: addDays(now, -1, 2),
    dropoffWindowEnd: addDays(now, -1, 4),
    licensePlate: "CA-CAN-601",
    vehicleColor: "Gray",
    vehicleMake: "Mazda",
    vehicleModel: "CX-5",
    vinVerificationCode: "6666",
    recipientName: "Cancelled Receiver",
    recipientEmail: "cancelled.receiver@example.com",
    recipientPhone: "+1 415 555 0505",
    etaMinutes: 18,
    bufferMinutes: 30,
    sameDayEligible: true,
    requiresOpsConfirmation: false,
    isUrgent: false,
    price: 80,
    distanceMiles: 6,
    pricingMode: EnumQuotePricingMode.FLAT_TIER,
    mileageCategory: EnumQuoteMileageCategory.A,
    trackingToken: "demo-cancelled-token",
  });

  const disputed = await ensureDemoDelivery({
    slug: "demo-disputed",
    customerId: refs.business2CustomerId,
    createdByUserId: refs.business2UserId,
    createdByRole: EnumDeliveryRequestCreatedByRole.BUSINESS_CUSTOMER,
    customerChose: EnumDeliveryRequestCustomerChose.DROPOFF_WINDOW,
    serviceType: EnumDeliveryRequestServiceType.BETWEEN_LOCATIONS,
    quoteServiceType: EnumQuoteServiceType.BETWEEN_LOCATIONS,
    status: EnumDeliveryRequestStatus.DISPUTED,
    pickupAddress: "2400 Broadway, Oakland, CA",
    pickupCity: "Oakland",
    pickupLat: 37.8113,
    pickupLng: -122.2687,
    pickupPlaceId: "demo-disputed-pickup",
    dropoffAddress: "100 Pine St, San Francisco, CA",
    dropoffCity: "San Francisco",
    dropoffLat: 37.7927,
    dropoffLng: -122.3981,
    dropoffPlaceId: "demo-disputed-dropoff",
    pickupWindowStart: addDays(now, -3),
    pickupWindowEnd: addDays(now, -3, 1),
    dropoffWindowStart: addDays(now, -3, 3),
    dropoffWindowEnd: addDays(now, -3, 5),
    licensePlate: "CA-DSP-701",
    vehicleColor: "White",
    vehicleMake: "Chevrolet",
    vehicleModel: "Malibu",
    vinVerificationCode: "7777",
    recipientName: "Disputed Receiver",
    recipientEmail: "disputed.receiver@example.com",
    recipientPhone: "+1 510 555 0606",
    etaMinutes: 42,
    bufferMinutes: 30,
    sameDayEligible: true,
    requiresOpsConfirmation: false,
    isUrgent: false,
    price: 190,
    distanceMiles: 21,
    pricingMode: EnumQuotePricingMode.CATEGORY_ABC,
    mileageCategory: EnumQuoteMileageCategory.A,
    trackingToken: "demo-disputed-token",
  });

  await ensureAssignment(booked.id, refs.driver1Id, refs.adminUserId, "Demo manual assignment");
  await ensureAssignment(active.id, refs.driver2Id, refs.adminUserId, "Driver dispatched and on trip");
  await ensureAssignment(completed.id, refs.driver3Id, refs.adminUserId, "Completed demo run");
  await ensureAssignment(disputed.id, refs.driver1Id, refs.adminUserId, "Historical disputed run");

  await ensureStatusHistory(listed.id, [
    historyItem(null, EnumDeliveryRequestStatus.QUOTED, refs.businessUserId, EnumDeliveryStatusHistoryActorRole.BUSINESS_CUSTOMER, "Created from quote"),
    historyItem(EnumDeliveryRequestStatus.QUOTED, EnumDeliveryRequestStatus.LISTED, refs.adminUserId, EnumDeliveryStatusHistoryActorRole.ADMIN, "Released to driver marketplace"),
  ]);

  await ensureStatusHistory(booked.id, [
    historyItem(null, EnumDeliveryRequestStatus.QUOTED, refs.business2UserId, EnumDeliveryStatusHistoryActorRole.BUSINESS_CUSTOMER, "Created from quote"),
    historyItem(EnumDeliveryRequestStatus.QUOTED, EnumDeliveryRequestStatus.LISTED, refs.adminUserId, EnumDeliveryStatusHistoryActorRole.ADMIN, "Listed"),
    historyItem(EnumDeliveryRequestStatus.LISTED, EnumDeliveryRequestStatus.BOOKED, refs.adminUserId, EnumDeliveryStatusHistoryActorRole.ADMIN, "Assigned to driver"),
  ]);

  await ensureStatusHistory(active.id, [
    historyItem(null, EnumDeliveryRequestStatus.QUOTED, refs.privateUserId, EnumDeliveryStatusHistoryActorRole.PRIVATE_CUSTOMER, "Created from quote"),
    historyItem(EnumDeliveryRequestStatus.QUOTED, EnumDeliveryRequestStatus.LISTED, refs.adminUserId, EnumDeliveryStatusHistoryActorRole.ADMIN, "Listed"),
    historyItem(EnumDeliveryRequestStatus.LISTED, EnumDeliveryRequestStatus.BOOKED, refs.adminUserId, EnumDeliveryStatusHistoryActorRole.ADMIN, "Assigned"),
    historyItem(EnumDeliveryRequestStatus.BOOKED, EnumDeliveryRequestStatus.ACTIVE, refs.driver2UserId, EnumDeliveryStatusHistoryActorRole.DRIVER, "Trip started"),
  ]);

  await ensureStatusHistory(completed.id, [
    historyItem(null, EnumDeliveryRequestStatus.QUOTED, refs.businessUserId, EnumDeliveryStatusHistoryActorRole.BUSINESS_CUSTOMER, "Created from quote"),
    historyItem(EnumDeliveryRequestStatus.QUOTED, EnumDeliveryRequestStatus.LISTED, refs.adminUserId, EnumDeliveryStatusHistoryActorRole.ADMIN, "Listed"),
    historyItem(EnumDeliveryRequestStatus.LISTED, EnumDeliveryRequestStatus.BOOKED, refs.adminUserId, EnumDeliveryStatusHistoryActorRole.ADMIN, "Assigned"),
    historyItem(EnumDeliveryRequestStatus.BOOKED, EnumDeliveryRequestStatus.ACTIVE, refs.driver3UserId, EnumDeliveryStatusHistoryActorRole.DRIVER, "Trip started"),
    historyItem(EnumDeliveryRequestStatus.ACTIVE, EnumDeliveryRequestStatus.COMPLETED, refs.driver3UserId, EnumDeliveryStatusHistoryActorRole.DRIVER, "Trip completed"),
  ]);

  await ensureStatusHistory(cancelled.id, [
    historyItem(null, EnumDeliveryRequestStatus.QUOTED, refs.privateUserId, EnumDeliveryStatusHistoryActorRole.PRIVATE_CUSTOMER, "Created from quote"),
    historyItem(EnumDeliveryRequestStatus.QUOTED, EnumDeliveryRequestStatus.CANCELLED, refs.adminUserId, EnumDeliveryStatusHistoryActorRole.ADMIN, "Cancelled by operations"),
  ]);

  await ensureStatusHistory(disputed.id, [
    historyItem(null, EnumDeliveryRequestStatus.QUOTED, refs.business2UserId, EnumDeliveryStatusHistoryActorRole.BUSINESS_CUSTOMER, "Created from quote"),
    historyItem(EnumDeliveryRequestStatus.QUOTED, EnumDeliveryRequestStatus.LISTED, refs.adminUserId, EnumDeliveryStatusHistoryActorRole.ADMIN, "Listed"),
    historyItem(EnumDeliveryRequestStatus.LISTED, EnumDeliveryRequestStatus.BOOKED, refs.adminUserId, EnumDeliveryStatusHistoryActorRole.ADMIN, "Assigned"),
    historyItem(EnumDeliveryRequestStatus.BOOKED, EnumDeliveryRequestStatus.ACTIVE, refs.driver1UserId, EnumDeliveryStatusHistoryActorRole.DRIVER, "Trip started"),
    historyItem(EnumDeliveryRequestStatus.ACTIVE, EnumDeliveryRequestStatus.DISPUTED, refs.adminUserId, EnumDeliveryStatusHistoryActorRole.ADMIN, "Escalated to dispute"),
  ]);

  await ensureCompliance(active.id, {
    vinVerificationCode: "4444",
    vinConfirmed: true,
    odometerStart: 12800,
    pickupCompletedAt: addMinutes(now, -55),
    verifiedByUserId: refs.adminUserId,
    verifiedByAdminAt: addMinutes(now, -50),
  });

  await ensureCompliance(completed.id, {
    vinVerificationCode: "5555",
    vinConfirmed: true,
    odometerStart: 20210,
    odometerEnd: 20248,
    pickupCompletedAt: addDays(now, -2, 1),
    dropoffCompletedAt: addDays(now, -2, 4),
    verifiedByUserId: refs.adminUserId,
    verifiedByAdminAt: addDays(now, -2, 4),
  });

  await ensureCompliance(disputed.id, {
    vinVerificationCode: "7777",
    vinConfirmed: true,
    odometerStart: 44001,
    odometerEnd: 44029,
    pickupCompletedAt: addDays(now, -3, 1),
    dropoffCompletedAt: addDays(now, -3, 4),
    verifiedByUserId: refs.adminUserId,
    verifiedByAdminAt: addDays(now, -3, 4),
  });

  await ensureEvidenceSet(active.id, "demo-active", EnumDeliveryEvidencePhase.PICKUP);
  await ensureEvidenceSet(completed.id, "demo-completed", EnumDeliveryEvidencePhase.PICKUP);
  await ensureEvidenceSet(completed.id, "demo-completed", EnumDeliveryEvidencePhase.DROPOFF);
  await ensureEvidenceSet(disputed.id, "demo-disputed", EnumDeliveryEvidencePhase.PICKUP);
  await ensureEvidenceSet(disputed.id, "demo-disputed", EnumDeliveryEvidencePhase.DROPOFF);

  await ensureTracking(active.id, {
    status: EnumTrackingSessionStatus.STARTED,
    startedAt: addMinutes(now, -50),
    stoppedAt: null,
    drivenMiles: 18.4,
    points: [
      { lat: 37.4526, lng: -122.1189, recordedAt: addMinutes(now, -45) },
      { lat: 37.4275, lng: -122.0993, recordedAt: addMinutes(now, -30) },
      { lat: 37.402, lng: -122.033, recordedAt: addMinutes(now, -10) },
    ],
  });

  await ensureTracking(completed.id, {
    status: EnumTrackingSessionStatus.STOPPED,
    startedAt: addDays(now, -2, 1),
    stoppedAt: addDays(now, -2, 4),
    drivenMiles: 38.2,
    points: [
      { lat: 37.563, lng: -122.3255, recordedAt: addDays(now, -2, 1) },
      { lat: 37.659, lng: -122.404, recordedAt: addDays(now, -2, 2) },
      { lat: 37.7752, lng: -122.4193, recordedAt: addDays(now, -2, 4) },
    ],
  });

  await ensureTracking(disputed.id, {
    status: EnumTrackingSessionStatus.STOPPED,
    startedAt: addDays(now, -3, 1),
    stoppedAt: addDays(now, -3, 4),
    drivenMiles: 22.1,
    points: [
      { lat: 37.8113, lng: -122.2687, recordedAt: addDays(now, -3, 1) },
      { lat: 37.8011, lng: -122.4103, recordedAt: addDays(now, -3, 2) },
      { lat: 37.7927, lng: -122.3981, recordedAt: addDays(now, -3, 4) },
    ],
  });

  await ensurePayment(completed.id, {
    amount: 275,
    paymentType: EnumPaymentPaymentType.POSTPAID,
    provider: EnumPaymentProvider.MANUAL,
    status: EnumPaymentStatus.PAID,
    invoiceId: "INV-DEMO-5001",
    paidAt: addDays(now, -1),
  });

  await ensurePayment(disputed.id, {
    amount: 190,
    paymentType: EnumPaymentPaymentType.PREPAID,
    provider: EnumPaymentProvider.STRIPE,
    status: EnumPaymentStatus.CAPTURED,
    providerPaymentIntentId: "pi_demo_disputed_001",
    providerChargeId: "ch_demo_disputed_001",
    authorizedAt: addDays(now, -3, 0),
    capturedAt: addDays(now, -3, 0),
  });

  await ensurePaymentEvents(completed.id, [
    {
      type: EnumPaymentEventType.INVOICE,
      status: EnumPaymentEventStatus.INVOICED,
      amount: 275,
      message: "Invoice issued",
    },
    {
      type: EnumPaymentEventType.MARK_PAID,
      status: EnumPaymentEventStatus.PAID,
      amount: 275,
      message: "Invoice marked paid",
    },
  ]);

  await ensurePaymentEvents(disputed.id, [
    {
      type: EnumPaymentEventType.AUTHORIZE,
      status: EnumPaymentEventStatus.AUTHORIZED,
      amount: 190,
      message: "Payment authorized",
    },
    {
      type: EnumPaymentEventType.CAPTURE,
      status: EnumPaymentEventStatus.CAPTURED,
      amount: 190,
      message: "Payment captured",
    },
  ]);

  await ensureTip(completed.id, {
    amount: 20,
    provider: EnumTipProvider.STRIPE,
    status: EnumTipStatus.CAPTURED,
    providerRef: "tip_demo_completed_001",
  });

  await ensurePayout(completed.id, refs.driver3Id, {
    grossAmount: 275,
    insuranceFee: 8,
    driverSharePct: 70,
    platformFee: 82.5,
    netAmount: 212.5,
    status: EnumDriverPayoutStatus.PAID,
    paidAt: addDays(now, -1),
    providerTransferId: "tr_demo_completed_001",
  });

  await ensureRating(completed.id, {
    customerId: refs.businessCustomerId,
    driverId: refs.driver3Id,
    stars: 5,
    target: EnumDeliveryRatingTarget.DRIVER,
    comment: "Smooth delivery and clear communication.",
  });

  await ensureDispute(disputed.id, {
    reason: "Customer reported minor scratch at drop-off.",
    status: EnumDisputeCaseStatus.UNDER_REVIEW,
    legalHold: false,
    note: "Photos uploaded. Ops reviewing pickup/drop-off condition evidence.",
    authorUserId: refs.adminUserId,
  });

  await ensureScheduleChangeRequest(booked.id, {
    requestedByUserId: refs.business2UserId,
    requestedByRole: EnumScheduleChangeRequestRequestedByRole.BUSINESS_CUSTOMER,
    proposedPickupWindowStart: addHours(now, 4),
    proposedPickupWindowEnd: addHours(now, 5),
    proposedDropoffWindowStart: addHours(now, 6),
    proposedDropoffWindowEnd: addHours(now, 8),
    reason: "Dealer requested later pickup due to buyer delay.",
    status: EnumScheduleChangeRequestStatus.PENDING,
  });

  await ensureNotification(completed.id, {
    customerId: refs.businessCustomerId,
    driverId: refs.driver3Id,
    actorUserId: refs.adminUserId,
    type: EnumNotificationEventType.DELIVERY_STATUS_CHANGED,
    channel: EnumNotificationEventChannel.EMAIL,
    status: EnumNotificationEventStatus.SENT,
    subject: "Delivery completed",
    body: "Your delivery has been completed successfully.",
    toEmail: "completed.receiver@example.com",
  });

  await ensureNotification(active.id, {
    customerId: refs.privateCustomerId,
    driverId: refs.driver2Id,
    actorUserId: refs.driver2UserId,
    type: EnumNotificationEventType.TRACKING_STARTED,
    channel: EnumNotificationEventChannel.SMS,
    status: EnumNotificationEventStatus.SENT,
    subject: "Tracking started",
    body: "Live tracking has started for your vehicle delivery.",
    toPhone: "+1 650 555 0101",
  });

  await ensureNotification(disputed.id, {
    customerId: refs.business2CustomerId,
    driverId: refs.driver1Id,
    actorUserId: refs.adminUserId,
    type: EnumNotificationEventType.DISPUTE_OPENED,
    channel: EnumNotificationEventChannel.EMAIL,
    status: EnumNotificationEventStatus.QUEUED,
    subject: "Dispute opened",
    body: "A dispute has been opened for this delivery.",
    toEmail: "dealer2@101drivers.techbee.et",
  });

  await ensureAudit({
    action: EnumAdminAuditLogAction.DELIVERY_REASSIGN,
    actorUserId: refs.adminUserId,
    actorType: EnumAdminAuditLogActorType.USER,
    deliveryId: booked.id,
    customerId: refs.business2CustomerId,
    driverId: refs.driver1Id,
    reason: "Demo assignment created",
    afterJson: { status: "BOOKED" },
  });

  await ensureAudit({
    action: EnumAdminAuditLogAction.DISPUTE_UPDATE,
    actorUserId: refs.adminUserId,
    actorType: EnumAdminAuditLogActorType.USER,
    deliveryId: disputed.id,
    customerId: refs.business2CustomerId,
    driverId: refs.driver1Id,
    reason: "Dispute escalated to under review",
    afterJson: { status: "DISPUTED" },
  });

  await ensureEvidenceExport(completed.id, refs.adminUserId, {
    url: "https://example.com/exports/demo-completed-evidence.zip",
    metaJson: { deliverySlug: "demo-completed", fileCount: 14 },
  });

  // keep unused vars referenced to avoid accidental pruning confusion in edits
  void quoted;
  void listed;
  void cancelled;
}

async function approveCustomer(customerId: string, adminUserId: string) {
  await prisma.customer.update({
    where: { id: customerId },
    data: {
      approvalStatus: EnumCustomerApprovalStatus.APPROVED,
      approvedAt: new Date(),
      approvedByUserId: adminUserId,
    },
  });
}

async function approveDriver(driverId: string, adminUserId: string) {
  await prisma.driver.update({
    where: { id: driverId },
    data: {
      status: EnumDriverStatus.APPROVED,
      approvedAt: new Date(),
      approvedByUserId: adminUserId,
    },
  });
}

async function ensureDriverPreferences(
  driverId: string,
  params: {
    city: string;
    radiusMiles: number;
    districts: string[];
    emailEnabled: boolean;
    smsEnabled: boolean;
  }
) {
  await prisma.driverPreference.upsert({
    where: { driverId },
    update: {
      city: params.city,
      radiusMiles: params.radiusMiles,
    },
    create: {
      driverId,
      city: params.city,
      radiusMiles: params.radiusMiles,
    },
  });

  await prisma.driverAlertPreference.upsert({
    where: { driverId },
    update: {
      enabled: true,
      emailEnabled: params.emailEnabled,
      smsEnabled: params.smsEnabled,
    },
    create: {
      driverId,
      enabled: true,
      emailEnabled: params.emailEnabled,
      smsEnabled: params.smsEnabled,
    },
  });

  const existing = await prisma.driverDistrictPreference.findMany({
    where: { driverId },
  });

  for (const row of existing) {
    if (!params.districts.includes(row.districtId)) {
      await prisma.driverDistrictPreference.delete({
        where: { id: row.id },
      });
    }
  }

  for (const districtId of params.districts) {
    const found = await prisma.driverDistrictPreference.findFirst({
      where: { driverId, districtId },
    });

    if (!found) {
      await prisma.driverDistrictPreference.create({
        data: {
          driverId,
          districtId,
        },
      });
    }
  }
}

async function ensurePricingConfiguration() {
  const existing = await prisma.pricingConfig.findFirst({
    where: { name: "Demo Default Pricing" },
  });

  const pricingConfig = existing
    ? await prisma.pricingConfig.update({
        where: { id: existing.id },
        data: {
          name: "Demo Default Pricing",
          description: "Default pricing for demo environment",
          active: true,
          baseFee: 45,
          insuranceFee: 8,
          driverSharePct: 70,
          feePassThrough: true,
          perMileRate: 4.5,
          pricingMode: EnumPricingConfigPricingMode.CATEGORY_ABC,
          transactionFeeFixed: 3,
          transactionFeePct: 2.9,
        },
      })
    : await prisma.pricingConfig.create({
        data: {
          name: "Demo Default Pricing",
          description: "Default pricing for demo environment",
          active: true,
          baseFee: 45,
          insuranceFee: 8,
          driverSharePct: 70,
          feePassThrough: true,
          perMileRate: 4.5,
          pricingMode: EnumPricingConfigPricingMode.CATEGORY_ABC,
          transactionFeeFixed: 3,
          transactionFeePct: 2.9,
        },
      });

  const tierRows = [
    { minMiles: 0, maxMiles: 10, flatPrice: 80 },
    { minMiles: 10.01, maxMiles: 25, flatPrice: 120 },
    { minMiles: 25.01, maxMiles: 50, flatPrice: 180 },
  ];

  for (const tier of tierRows) {
    const existingTier = await prisma.pricingTier.findFirst({
      where: {
        pricingConfigId: pricingConfig.id,
        minMiles: tier.minMiles,
      },
    });

    if (existingTier) {
      await prisma.pricingTier.update({
        where: { id: existingTier.id },
        data: tier,
      });
    } else {
      await prisma.pricingTier.create({
        data: {
          pricingConfigId: pricingConfig.id,
          ...tier,
        },
      });
    }
  }

  const categoryRules = [
    {
      category: EnumPricingCategoryRuleCategory.A,
      minMiles: 0,
      maxMiles: 25,
      flatPrice: 95,
      baseFee: null,
      perMileRate: null,
    },
    {
      category: EnumPricingCategoryRuleCategory.B,
      minMiles: 25.01,
      maxMiles: 75,
      flatPrice: null,
      baseFee: 55,
      perMileRate: 4.25,
    },
    {
      category: EnumPricingCategoryRuleCategory.C,
      minMiles: 75.01,
      maxMiles: null,
      flatPrice: null,
      baseFee: 70,
      perMileRate: 4.75,
    },
  ];

  for (const rule of categoryRules) {
    const existingRule = await prisma.pricingCategoryRule.findFirst({
      where: {
        pricingConfigId: pricingConfig.id,
        category: rule.category,
      },
    });

    if (existingRule) {
      await prisma.pricingCategoryRule.update({
        where: { id: existingRule.id },
        data: {
          minMiles: rule.minMiles,
          maxMiles: rule.maxMiles,
          flatPrice: rule.flatPrice,
          baseFee: rule.baseFee,
          perMileRate: rule.perMileRate,
        },
      });
    } else {
      await prisma.pricingCategoryRule.create({
        data: {
          pricingConfigId: pricingConfig.id,
          category: rule.category,
          minMiles: rule.minMiles,
          maxMiles: rule.maxMiles,
          flatPrice: rule.flatPrice,
          baseFee: rule.baseFee,
          perMileRate: rule.perMileRate,
        },
      });
    }
  }

  return pricingConfig;
}

async function ensureDemoDelivery(input: {
  slug: string;
  customerId: string;
  createdByUserId: string;
  createdByRole: EnumDeliveryRequestCreatedByRole;
  customerChose: EnumDeliveryRequestCustomerChose;
  serviceType: EnumDeliveryRequestServiceType;
  quoteServiceType: EnumQuoteServiceType;
  status: EnumDeliveryRequestStatus;
  pickupAddress: string;
  pickupCity: string;
  pickupLat: number;
  pickupLng: number;
  pickupPlaceId: string;
  dropoffAddress: string;
  dropoffCity: string;
  dropoffLat: number;
  dropoffLng: number;
  dropoffPlaceId: string;
  pickupWindowStart: Date;
  pickupWindowEnd: Date;
  dropoffWindowStart: Date;
  dropoffWindowEnd: Date;
  licensePlate: string;
  vehicleColor: string;
  vehicleMake: string;
  vehicleModel: string;
  vinVerificationCode: string;
  recipientName: string;
  recipientEmail: string;
  recipientPhone: string;
  etaMinutes: number;
  bufferMinutes: number;
  sameDayEligible: boolean;
  requiresOpsConfirmation: boolean;
  isUrgent: boolean;
  urgentBonusAmount?: number;
  price: number;
  distanceMiles: number;
  pricingMode: EnumQuotePricingMode;
  mileageCategory: EnumQuoteMileageCategory;
  trackingToken: string;
}) {
  const quote = await ensureQuoteForSlug(input.slug, {
    pickupAddress: input.pickupAddress,
    pickupLat: input.pickupLat,
    pickupLng: input.pickupLng,
    pickupPlaceId: input.pickupPlaceId,
    pickupState: "CA",
    dropoffAddress: input.dropoffAddress,
    dropoffLat: input.dropoffLat,
    dropoffLng: input.dropoffLng,
    dropoffPlaceId: input.dropoffPlaceId,
    dropoffState: "CA",
    distanceMiles: input.distanceMiles,
    estimatedPrice: input.price,
    pricingMode: input.pricingMode,
    mileageCategory: input.mileageCategory,
    serviceType: input.quoteServiceType,
  });

  const existing = await prisma.deliveryRequest.findFirst({
    where: { trackingShareToken: input.trackingToken },
  });

  if (existing) {
    return prisma.deliveryRequest.update({
      where: { id: existing.id },
      data: {
        customerId: input.customerId,
        createdByUserId: input.createdByUserId,
        createdByRole: input.createdByRole,
        customerChose: input.customerChose,
        quoteId: quote.id,
        serviceType: input.serviceType,
        status: input.status,
        pickupAddress: input.pickupAddress,
        pickupLat: input.pickupLat,
        pickupLng: input.pickupLng,
        pickupPlaceId: input.pickupPlaceId,
        pickupState: "CA",
        dropoffAddress: input.dropoffAddress,
        dropoffLat: input.dropoffLat,
        dropoffLng: input.dropoffLng,
        dropoffPlaceId: input.dropoffPlaceId,
        dropoffState: "CA",
        pickupWindowStart: input.pickupWindowStart,
        pickupWindowEnd: input.pickupWindowEnd,
        dropoffWindowStart: input.dropoffWindowStart,
        dropoffWindowEnd: input.dropoffWindowEnd,
        etaMinutes: input.etaMinutes,
        bufferMinutes: input.bufferMinutes,
        sameDayEligible: input.sameDayEligible,
        requiresOpsConfirmation: input.requiresOpsConfirmation,
        afterHours: false,
        isUrgent: input.isUrgent,
        urgentBonusAmount: input.urgentBonusAmount ?? null,
        licensePlate: input.licensePlate,
        vehicleColor: input.vehicleColor,
        vehicleMake: input.vehicleMake,
        vehicleModel: input.vehicleModel,
        vinVerificationCode: input.vinVerificationCode,
        recipientName: input.recipientName,
        recipientEmail: input.recipientEmail,
        recipientPhone: input.recipientPhone,
      },
    });
  }

  return prisma.deliveryRequest.create({
    data: {
      customerId: input.customerId,
      createdByUserId: input.createdByUserId,
      createdByRole: input.createdByRole,
      customerChose: input.customerChose,
      quoteId: quote.id,
      serviceType: input.serviceType,
      status: input.status,
      pickupAddress: input.pickupAddress,
      pickupLat: input.pickupLat,
      pickupLng: input.pickupLng,
      pickupPlaceId: input.pickupPlaceId,
      pickupState: "CA",
      dropoffAddress: input.dropoffAddress,
      dropoffLat: input.dropoffLat,
      dropoffLng: input.dropoffLng,
      dropoffPlaceId: input.dropoffPlaceId,
      dropoffState: "CA",
      pickupWindowStart: input.pickupWindowStart,
      pickupWindowEnd: input.pickupWindowEnd,
      dropoffWindowStart: input.dropoffWindowStart,
      dropoffWindowEnd: input.dropoffWindowEnd,
      etaMinutes: input.etaMinutes,
      bufferMinutes: input.bufferMinutes,
      sameDayEligible: input.sameDayEligible,
      requiresOpsConfirmation: input.requiresOpsConfirmation,
      afterHours: false,
      isUrgent: input.isUrgent,
      urgentBonusAmount: input.urgentBonusAmount ?? null,
      licensePlate: input.licensePlate,
      vehicleColor: input.vehicleColor,
      vehicleMake: input.vehicleMake,
      vehicleModel: input.vehicleModel,
      vinVerificationCode: input.vinVerificationCode,
      recipientName: input.recipientName,
      recipientEmail: input.recipientEmail,
      recipientPhone: input.recipientPhone,
      trackingShareToken: input.trackingToken,
      trackingShareExpiresAt: addDays(new Date(), 3),
    },
  });
}

async function ensureQuoteForSlug(
  slug: string,
  input: {
    pickupAddress: string;
    pickupLat: number;
    pickupLng: number;
    pickupPlaceId: string;
    pickupState: string;
    dropoffAddress: string;
    dropoffLat: number;
    dropoffLng: number;
    dropoffPlaceId: string;
    dropoffState: string;
    distanceMiles: number;
    estimatedPrice: number;
    pricingMode: EnumQuotePricingMode;
    mileageCategory: EnumQuoteMileageCategory;
    serviceType: EnumQuoteServiceType;
  }
) {
  const existingDelivery = await prisma.deliveryRequest.findFirst({
    where: { trackingShareToken: `${slug}-token` },
    select: { quoteId: true },
  });

  if (existingDelivery?.quoteId) {
    return prisma.quote.update({
      where: { id: existingDelivery.quoteId },
      data: {
        pickupAddress: input.pickupAddress,
        pickupLat: input.pickupLat,
        pickupLng: input.pickupLng,
        pickupPlaceId: input.pickupPlaceId,
        pickupState: input.pickupState,
        dropoffAddress: input.dropoffAddress,
        dropoffLat: input.dropoffLat,
        dropoffLng: input.dropoffLng,
        dropoffPlaceId: input.dropoffPlaceId,
        dropoffState: input.dropoffState,
        distanceMiles: input.distanceMiles,
        estimatedPrice: input.estimatedPrice,
        pricingMode: input.pricingMode,
        mileageCategory: input.mileageCategory,
        serviceType: input.serviceType,
        routePolyline: `polyline-${slug}`,
        feesBreakdown: {
          total: input.estimatedPrice,
          insuranceFee: 8,
        },
        pricingSnapshot: {
          slug,
          mode: input.pricingMode,
          miles: input.distanceMiles,
          driverSharePct: 70,
        },
      },
    });
  }

  return prisma.quote.create({
    data: {
      pickupAddress: input.pickupAddress,
      pickupLat: input.pickupLat,
      pickupLng: input.pickupLng,
      pickupPlaceId: input.pickupPlaceId,
      pickupState: input.pickupState,
      dropoffAddress: input.dropoffAddress,
      dropoffLat: input.dropoffLat,
      dropoffLng: input.dropoffLng,
      dropoffPlaceId: input.dropoffPlaceId,
      dropoffState: input.dropoffState,
      distanceMiles: input.distanceMiles,
      estimatedPrice: input.estimatedPrice,
      pricingMode: input.pricingMode,
      mileageCategory: input.mileageCategory,
      serviceType: input.serviceType,
      routePolyline: `polyline-${slug}`,
      feesBreakdown: {
        total: input.estimatedPrice,
        insuranceFee: 8,
      },
      pricingSnapshot: {
        slug,
        mode: input.pricingMode,
        miles: input.distanceMiles,
        driverSharePct: 70,
      },
    },
  });
}

async function ensureAssignment(
  deliveryId: string,
  driverId: string,
  assignedByUserId: string,
  reason: string
) {
  const existing = await prisma.deliveryAssignment.findFirst({
    where: {
      deliveryId,
      driverId,
      unassignedAt: null,
    },
  });

  if (existing) {
    return prisma.deliveryAssignment.update({
      where: { id: existing.id },
      data: {
        assignedByUserId,
        reason,
      },
    });
  }

  return prisma.deliveryAssignment.create({
    data: {
      deliveryId,
      driverId,
      assignedByUserId,
      reason,
    },
  });
}

function historyItem(
  fromStatus: EnumDeliveryRequestStatus | null,
  toStatus: EnumDeliveryRequestStatus,
  actorUserId: string,
  actorRole: EnumDeliveryStatusHistoryActorRole,
  note: string
) {
  return {
    fromStatus,
    toStatus,
    actorUserId,
    actorRole,
    actorType: EnumDeliveryStatusHistoryActorType.USER,
    note,
  };
}

async function ensureStatusHistory(
  deliveryId: string,
  items: Array<{
    fromStatus: EnumDeliveryRequestStatus | null;
    toStatus: EnumDeliveryRequestStatus;
    actorUserId: string;
    actorRole: EnumDeliveryStatusHistoryActorRole;
    actorType: EnumDeliveryStatusHistoryActorType;
    note: string;
  }>
) {
  await prisma.deliveryStatusHistory.deleteMany({
    where: { deliveryId },
  });

  for (const item of items) {
    await prisma.deliveryStatusHistory.create({
      data: {
        deliveryId,
        actorUserId: item.actorUserId,
        actorRole: item.actorRole,
        actorType: item.actorType,
        fromStatus:
          item.fromStatus as EnumDeliveryStatusHistoryFromStatus | null,
        toStatus: item.toStatus as EnumDeliveryStatusHistoryToStatus,
        note: item.note,
      },
    });
  }
}

async function ensureCompliance(
  deliveryId: string,
  input: {
    vinVerificationCode: string;
    vinConfirmed: boolean;
    odometerStart?: number;
    odometerEnd?: number;
    pickupCompletedAt?: Date;
    dropoffCompletedAt?: Date;
    verifiedByUserId?: string;
    verifiedByAdminAt?: Date;
  }
) {
  return prisma.deliveryCompliance.upsert({
    where: { deliveryId },
    update: {
      vinVerificationCode: input.vinVerificationCode,
      vinConfirmed: input.vinConfirmed,
      odometerStart: input.odometerStart ?? null,
      odometerEnd: input.odometerEnd ?? null,
      pickupCompletedAt: input.pickupCompletedAt ?? null,
      dropoffCompletedAt: input.dropoffCompletedAt ?? null,
      verifiedByUserId: input.verifiedByUserId ?? null,
      verifiedByAdminAt: input.verifiedByAdminAt ?? null,
    },
    create: {
      deliveryId,
      vinVerificationCode: input.vinVerificationCode,
      vinConfirmed: input.vinConfirmed,
      odometerStart: input.odometerStart ?? null,
      odometerEnd: input.odometerEnd ?? null,
      pickupCompletedAt: input.pickupCompletedAt ?? null,
      dropoffCompletedAt: input.dropoffCompletedAt ?? null,
      verifiedByUserId: input.verifiedByUserId ?? null,
      verifiedByAdminAt: input.verifiedByAdminAt ?? null,
    },
  });
}

async function ensureEvidenceSet(
  deliveryId: string,
  slug: string,
  phase: EnumDeliveryEvidencePhase
) {
  const base = phase === EnumDeliveryEvidencePhase.PICKUP ? 1 : 10;

  for (let i = 1; i <= 6; i++) {
    await upsertEvidence(deliveryId, phase, EnumDeliveryEvidenceType[
      phase === EnumDeliveryEvidencePhase.PICKUP ? "PICKUP_PHOTO" : "DROPOFF_PHOTO"
    ], i, {
      imageUrl: `https://picsum.photos/seed/${slug}-${phase.toLowerCase()}-${i}/1200/800`,
      value: null,
    });
  }

  if (phase === EnumDeliveryEvidencePhase.PICKUP) {
    await upsertEvidence(
      deliveryId,
      phase,
      EnumDeliveryEvidenceType.VIN_CONFIRMATION,
      base + 100,
      { value: "VIN verified at pickup" }
    );
    await upsertEvidence(
      deliveryId,
      phase,
      EnumDeliveryEvidenceType.ODOMETER_START,
      base + 101,
      { value: "12800" }
    );
  } else {
    await upsertEvidence(
      deliveryId,
      phase,
      EnumDeliveryEvidenceType.ODOMETER_END,
      base + 101,
      { value: "12848" }
    );
  }
}

async function upsertEvidence(
  deliveryId: string,
  phase: EnumDeliveryEvidencePhase,
  type: EnumDeliveryEvidenceType,
  slotIndex: number,
  values: { imageUrl?: string | null; value?: string | null }
) {
  const existing = await prisma.deliveryEvidence.findFirst({
    where: {
      deliveryId,
      phase,
      type,
      slotIndex,
    },
  });

  if (existing) {
    return prisma.deliveryEvidence.update({
      where: { id: existing.id },
      data: {
        imageUrl: values.imageUrl ?? null,
        value: values.value ?? null,
      },
    });
  }

  return prisma.deliveryEvidence.create({
    data: {
      deliveryId,
      phase,
      type,
      slotIndex,
      imageUrl: values.imageUrl ?? null,
      value: values.value ?? null,
    },
  });
}

async function ensureTracking(
  deliveryId: string,
  input: {
    status: EnumTrackingSessionStatus;
    startedAt: Date | null;
    stoppedAt: Date | null;
    drivenMiles: number | null;
    points: Array<{
      lat: number;
      lng: number;
      recordedAt: Date;
    }>;
  }
) {
  const session = await prisma.trackingSession.upsert({
    where: { deliveryId },
    update: {
      status: input.status,
      startedAt: input.startedAt,
      stoppedAt: input.stoppedAt,
      drivenMiles: input.drivenMiles,
    },
    create: {
      deliveryId,
      status: input.status,
      startedAt: input.startedAt,
      stoppedAt: input.stoppedAt,
      drivenMiles: input.drivenMiles,
    },
  });

  await prisma.trackingPoint.deleteMany({
    where: { sessionId: session.id },
  });

  for (const point of input.points) {
    await prisma.trackingPoint.create({
      data: {
        sessionId: session.id,
        lat: point.lat,
        lng: point.lng,
        recordedAt: point.recordedAt,
      },
    });
  }

  return session;
}

async function ensurePayment(
  deliveryId: string,
  input: {
    amount: number;
    paymentType: EnumPaymentPaymentType;
    provider: EnumPaymentProvider;
    status: EnumPaymentStatus;
    invoiceId?: string;
    providerPaymentIntentId?: string;
    providerChargeId?: string;
    authorizedAt?: Date;
    capturedAt?: Date;
    paidAt?: Date;
  }
) {
  return prisma.payment.upsert({
    where: { deliveryId },
    update: {
      amount: input.amount,
      paymentType: input.paymentType,
      provider: input.provider,
      status: input.status,
      invoiceId: input.invoiceId ?? null,
      providerPaymentIntentId: input.providerPaymentIntentId ?? null,
      providerChargeId: input.providerChargeId ?? null,
      authorizedAt: input.authorizedAt ?? null,
      capturedAt: input.capturedAt ?? null,
      paidAt: input.paidAt ?? null,
    },
    create: {
      deliveryId,
      amount: input.amount,
      paymentType: input.paymentType,
      provider: input.provider,
      status: input.status,
      invoiceId: input.invoiceId ?? null,
      providerPaymentIntentId: input.providerPaymentIntentId ?? null,
      providerChargeId: input.providerChargeId ?? null,
      authorizedAt: input.authorizedAt ?? null,
      capturedAt: input.capturedAt ?? null,
      paidAt: input.paidAt ?? null,
    },
  });
}

async function ensurePaymentEvents(
  deliveryId: string,
  events: Array<{
    type: EnumPaymentEventType;
    status: EnumPaymentEventStatus;
    amount: number;
    message: string;
  }>
) {
  const payment = await prisma.payment.findUnique({
    where: { deliveryId },
  });

  if (!payment) return;

  await prisma.paymentEvent.deleteMany({
    where: { paymentId: payment.id },
  });

  for (const item of events) {
    await prisma.paymentEvent.create({
      data: {
        paymentId: payment.id,
        type: item.type,
        status: item.status,
        amount: item.amount,
        message: item.message,
        providerRef: `demo-${item.type.toLowerCase()}-${deliveryId}`,
        raw: { demo: true },
      },
    });
  }
}

async function ensureTip(
  deliveryId: string,
  input: {
    amount: number;
    provider: EnumTipProvider;
    status: EnumTipStatus;
    providerRef?: string;
  }
) {
  return prisma.tip.upsert({
    where: { deliveryId },
    update: {
      amount: input.amount,
      provider: input.provider,
      status: input.status,
      providerRef: input.providerRef ?? null,
    },
    create: {
      deliveryId,
      amount: input.amount,
      provider: input.provider,
      status: input.status,
      providerRef: input.providerRef ?? null,
    },
  });
}

async function ensurePayout(
  deliveryId: string,
  driverId: string,
  input: {
    grossAmount: number;
    insuranceFee: number;
    driverSharePct: number;
    platformFee: number;
    netAmount: number;
    status: EnumDriverPayoutStatus;
    paidAt?: Date;
    providerTransferId?: string;
  }
) {
  return prisma.driverPayout.upsert({
    where: { deliveryId },
    update: {
      driverId,
      grossAmount: input.grossAmount,
      insuranceFee: input.insuranceFee,
      driverSharePct: input.driverSharePct,
      platformFee: input.platformFee,
      netAmount: input.netAmount,
      status: input.status,
      paidAt: input.paidAt ?? null,
      providerTransferId: input.providerTransferId ?? null,
    },
    create: {
      deliveryId,
      driverId,
      grossAmount: input.grossAmount,
      insuranceFee: input.insuranceFee,
      driverSharePct: input.driverSharePct,
      platformFee: input.platformFee,
      netAmount: input.netAmount,
      status: input.status,
      paidAt: input.paidAt ?? null,
      providerTransferId: input.providerTransferId ?? null,
    },
  });
}

async function ensureRating(
  deliveryId: string,
  input: {
    customerId: string;
    driverId: string;
    stars: number;
    target: EnumDeliveryRatingTarget;
    comment?: string;
  }
) {
  return prisma.deliveryRating.upsert({
    where: { deliveryId },
    update: {
      customerId: input.customerId,
      driverId: input.driverId,
      stars: input.stars,
      target: input.target,
      comment: input.comment ?? null,
    },
    create: {
      deliveryId,
      customerId: input.customerId,
      driverId: input.driverId,
      stars: input.stars,
      target: input.target,
      comment: input.comment ?? null,
    },
  });
}

async function ensureDispute(
  deliveryId: string,
  input: {
    reason: string;
    status: EnumDisputeCaseStatus;
    legalHold: boolean;
    note: string;
    authorUserId: string;
  }
) {
  const dispute = await prisma.disputeCase.upsert({
    where: { deliveryId },
    update: {
      reason: input.reason,
      status: input.status,
      legalHold: input.legalHold,
      openedAt: new Date(),
    },
    create: {
      deliveryId,
      reason: input.reason,
      status: input.status,
      legalHold: input.legalHold,
    },
  });

  const existingNote = await prisma.disputeNote.findFirst({
    where: {
      disputeId: dispute.id,
      authorUserId: input.authorUserId,
    },
  });

  if (existingNote) {
    await prisma.disputeNote.update({
      where: { id: existingNote.id },
      data: { note: input.note },
    });
  } else {
    await prisma.disputeNote.create({
      data: {
        disputeId: dispute.id,
        authorUserId: input.authorUserId,
        note: input.note,
      },
    });
  }

  return dispute;
}

async function ensureScheduleChangeRequest(
  deliveryId: string,
  input: {
    requestedByUserId: string;
    requestedByRole: EnumScheduleChangeRequestRequestedByRole;
    proposedPickupWindowStart: Date;
    proposedPickupWindowEnd: Date;
    proposedDropoffWindowStart: Date;
    proposedDropoffWindowEnd: Date;
    reason: string;
    status: EnumScheduleChangeRequestStatus;
  }
) {
  const existing = await prisma.scheduleChangeRequest.findFirst({
    where: { deliveryId },
  });

  if (existing) {
    return prisma.scheduleChangeRequest.update({
      where: { id: existing.id },
      data: {
        requestedByUserId: input.requestedByUserId,
        requestedByRole: input.requestedByRole,
        proposedPickupWindowStart: input.proposedPickupWindowStart,
        proposedPickupWindowEnd: input.proposedPickupWindowEnd,
        proposedDropoffWindowStart: input.proposedDropoffWindowStart,
        proposedDropoffWindowEnd: input.proposedDropoffWindowEnd,
        reason: input.reason,
        status: input.status,
      },
    });
  }

  return prisma.scheduleChangeRequest.create({
    data: {
      deliveryId,
      requestedByUserId: input.requestedByUserId,
      requestedByRole: input.requestedByRole,
      proposedPickupWindowStart: input.proposedPickupWindowStart,
      proposedPickupWindowEnd: input.proposedPickupWindowEnd,
      proposedDropoffWindowStart: input.proposedDropoffWindowStart,
      proposedDropoffWindowEnd: input.proposedDropoffWindowEnd,
      reason: input.reason,
      status: input.status,
    },
  });
}

async function ensureNotification(
  deliveryId: string,
  input: {
    customerId?: string;
    driverId?: string;
    actorUserId?: string;
    type: EnumNotificationEventType;
    channel: EnumNotificationEventChannel;
    status: EnumNotificationEventStatus;
    subject?: string;
    body?: string;
    toEmail?: string;
    toPhone?: string;
  }
) {
  const existing = await prisma.notificationEvent.findFirst({
    where: {
      deliveryId,
      type: input.type,
      channel: input.channel,
    },
  });

  if (existing) {
    return prisma.notificationEvent.update({
      where: { id: existing.id },
      data: {
        customerId: input.customerId ?? null,
        driverId: input.driverId ?? null,
        actorUserId: input.actorUserId ?? null,
        status: input.status,
        subject: input.subject ?? null,
        body: input.body ?? null,
        toEmail: input.toEmail ?? null,
        toPhone: input.toPhone ?? null,
        payload: { demo: true, deliveryId },
      },
    });
  }

  return prisma.notificationEvent.create({
    data: {
      deliveryId,
      customerId: input.customerId ?? null,
      driverId: input.driverId ?? null,
      actorUserId: input.actorUserId ?? null,
      type: input.type,
      channel: input.channel,
      status: input.status,
      subject: input.subject ?? null,
      body: input.body ?? null,
      toEmail: input.toEmail ?? null,
      toPhone: input.toPhone ?? null,
      payload: { demo: true, deliveryId },
    },
  });
}

async function ensureAudit(input: {
  action: EnumAdminAuditLogAction;
  actorUserId?: string;
  actorType: EnumAdminAuditLogActorType;
  deliveryId?: string;
  customerId?: string;
  driverId?: string;
  userId?: string;
  reason?: string;
  beforeJson?: unknown;
  afterJson?: unknown;
}) {
  const existing = await prisma.adminAuditLog.findFirst({
    where: {
      action: input.action,
      deliveryId: input.deliveryId ?? null,
      customerId: input.customerId ?? null,
      driverId: input.driverId ?? null,
    },
  });

  if (existing) {
    return prisma.adminAuditLog.update({
      where: { id: existing.id },
      data: {
        actorUserId: input.actorUserId ?? null,
        actorType: input.actorType,
        userId: input.userId ?? null,
        reason: input.reason ?? null,
        beforeJson: input.beforeJson as any,
        afterJson: input.afterJson as any,
      },
    });
  }

  return prisma.adminAuditLog.create({
    data: {
      action: input.action,
      actorUserId: input.actorUserId ?? null,
      actorType: input.actorType,
      deliveryId: input.deliveryId ?? null,
      customerId: input.customerId ?? null,
      driverId: input.driverId ?? null,
      userId: input.userId ?? null,
      reason: input.reason ?? null,
      beforeJson: input.beforeJson as any,
      afterJson: input.afterJson as any,
    },
  });
}

async function ensureEvidenceExport(
  deliveryId: string,
  createdByUserId: string,
  input: {
    url: string;
    metaJson?: unknown;
  }
) {
  const existing = await prisma.evidenceExport.findFirst({
    where: { deliveryId },
  });

  if (existing) {
    return prisma.evidenceExport.update({
      where: { id: existing.id },
      data: {
        createdByUserId,
        url: input.url,
        metaJson: input.metaJson as any,
      },
    });
  }

  return prisma.evidenceExport.create({
    data: {
      deliveryId,
      createdByUserId,
      url: input.url,
      metaJson: input.metaJson as any,
    },
  });
}

async function upsertDealerLead(input: {
  businessName: string;
  email: string;
  phone?: string;
  message?: string;
}) {
  const existing = await prisma.dealerLead.findFirst({
    where: { email: input.email },
  });

  if (existing) {
    return prisma.dealerLead.update({
      where: { id: existing.id },
      data: {
        businessName: input.businessName,
        phone: input.phone ?? null,
        message: input.message ?? null,
      },
    });
  }

  return prisma.dealerLead.create({
    data: {
      businessName: input.businessName,
      email: input.email,
      phone: input.phone ?? null,
      message: input.message ?? null,
    },
  });
}

async function upsertInvestorLead(input: {
  name: string;
  email: string;
  message?: string;
}) {
  const existing = await prisma.investorLead.findFirst({
    where: { email: input.email },
  });

  if (existing) {
    return prisma.investorLead.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        message: input.message ?? null,
      },
    });
  }

  return prisma.investorLead.create({
    data: {
      name: input.name,
      email: input.email,
      message: input.message ?? null,
    },
  });
}

function addMinutes(base: Date, minutes: number) {
  return new Date(base.getTime() + minutes * 60 * 1000);
}

function addHours(base: Date, hours: number) {
  return addMinutes(base, hours * 60);
}

function addDays(base: Date, days: number, extraHours = 0) {
  return addHours(new Date(base.getTime() + days * 24 * 60 * 60 * 1000), extraHours);
}