// src/scripts/seed/utils.ts

import { PrismaClient, EnumUserRoles, EnumCustomerCustomerType } from "@prisma/client";
import { hash } from "bcrypt";
import { Salt } from "../../src/auth/password.service";

export const prisma = new PrismaClient();

export async function hashPassword(passwordPlain: string, salt: Salt) {
  return hash(passwordPlain, salt);
}

export async function upsertUser(params: {
  username: string;
  email: string;
  passwordPlain: string;
  role: EnumUserRoles;
  fullName: string;
  phone?: string;
  bcryptSalt: Salt;
}) {
  const password = await hashPassword(params.passwordPlain, params.bcryptSalt);

  return prisma.user.upsert({
    where: { username: params.username },
    update: {
      email: params.email,
      password,
      roles: params.role,
      fullName: params.fullName,
      phone: params.phone ?? null,
      isActive: true,
    },
    create: {
      username: params.username,
      email: params.email,
      password,
      roles: params.role,
      fullName: params.fullName,
      phone: params.phone ?? null,
      isActive: true,
    },
  });
}

export async function upsertCustomerProfile(params: {
  userId: string;
  customerType: EnumCustomerCustomerType;
  businessName?: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  businessPhone?: string;
  businessWebsite?: string;
  businessAddress?: string;
  phone?: string;
}) {
  return prisma.customer.upsert({
    where: { userId: params.userId },
    update: {
      customerType: params.customerType,
      businessName: params.businessName ?? null,
      contactName: params.contactName,
      contactEmail: params.contactEmail,
      contactPhone: params.contactPhone ?? null,
      businessPhone: params.businessPhone ?? null,
      businessWebsite: params.businessWebsite ?? null,
      businessAddress: params.businessAddress ?? null,
      phone: params.phone ?? null,
    },
    create: {
      userId: params.userId,
      customerType: params.customerType,
      businessName: params.businessName ?? null,
      contactName: params.contactName,
      contactEmail: params.contactEmail,
      contactPhone: params.contactPhone ?? null,
      businessPhone: params.businessPhone ?? null,
      businessWebsite: params.businessWebsite ?? null,
      businessAddress: params.businessAddress ?? null,
      phone: params.phone ?? null,
      // approvalStatus default(PENDING) in schema
      // postpaidEnabled default(false)
    },
  });
}

export async function upsertDriverProfile(params: {
  userId: string;
  phone?: string;
  profilePhotoUrl?: string;
}) {
  return prisma.driver.upsert({
    where: { userId: params.userId },
    update: {
      phone: params.phone ?? null,
      profilePhotoUrl: params.profilePhotoUrl ?? null,
    },
    create: {
      userId: params.userId,
      phone: params.phone ?? null,
      profilePhotoUrl: params.profilePhotoUrl ?? null,
      // status default(PENDING)
    },
  });
}

// helper since SavedAddress has no unique on (customerId,label)
export async function ensureCustomerAddress(params: {
  customerId: string;
  label: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  lat?: number;
  lng?: number;
  placeId?: string;
}) {
  const existing = await prisma.savedAddress.findFirst({
    where: {
      customerId: params.customerId,
      label: params.label,
    },
  });

  if (existing) {
    return prisma.savedAddress.update({
      where: { id: existing.id },
      data: {
        address: params.address,
        city: params.city,
        state: params.state,
        postalCode: params.postalCode,
        country: params.country,
        isDefault: params.isDefault,
        lat: params.lat ?? null,
        lng: params.lng ?? null,
        placeId: params.placeId ?? null,
      },
    });
  }

  return prisma.savedAddress.create({
    data: {
      customerId: params.customerId,
      label: params.label,
      address: params.address,
      city: params.city,
      state: params.state,
      postalCode: params.postalCode,
      country: params.country,
      isDefault: params.isDefault,
      lat: params.lat ?? null,
      lng: params.lng ?? null,
      placeId: params.placeId ?? null,
    },
  });
}


export async function ensureCustomerVehicle(params: {
  customerId: string;
  make: string;
  model: string;
  color: string;
  licensePlate: string;
}) {
  const existing = await prisma.savedVehicle.findFirst({
    where: { customerId: params.customerId, licensePlate: params.licensePlate },
  });

  if (existing) {
    return prisma.savedVehicle.update({
      where: { id: existing.id },
      data: {
        make: params.make,
        model: params.model,
        color: params.color,
      },
    });
  }

  return prisma.savedVehicle.create({
    data: {
      customerId: params.customerId,
      make: params.make,
      model: params.model,
      color: params.color,
      licensePlate: params.licensePlate,
    },
  });
}
