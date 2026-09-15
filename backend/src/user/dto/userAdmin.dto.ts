import * as swagger from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from "class-validator";

const toBoolean = ({ value }: { value: any }) =>
  value === true || value === "true";

const toNumberOrDefault =
  (fallback: number) =>
  ({ value }: { value: any }) =>
    value === undefined || value === null || value === ""
      ? fallback
      : Number(value);



export class UserAdminUpdateCustomerDto {
  @swagger.ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string | null;

  @swagger.ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactName?: string | null;

  @swagger.ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  contactEmail?: string | null;

  @swagger.ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactPhone?: string | null;

  @swagger.ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultPickupId?: string | null;

  @swagger.ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  postpaidEnabled?: boolean;
}

export class UserAdminUpdateDriverDto {
  @swagger.ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string | null;

  @swagger.ApiPropertyOptional()
  @IsOptional()
  @IsString()
  profilePhotoUrl?: string | null;

  @swagger.ApiPropertyOptional()
  @IsOptional()
  @IsString()
  selfiePhotoUrl?: string | null;

  @swagger.ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d{5}$/, { message: 'ZIP code must be exactly 5 digits' })
  residentialZip?: string | null;
}

export class UserAdminUpdateBodyDto {
  @swagger.ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @swagger.ApiPropertyOptional()
  @IsOptional()
  @IsString()
  username?: string;

  @swagger.ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fullName?: string | null;

  @swagger.ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string | null;

  @swagger.ApiPropertyOptional({ type: () => UserAdminUpdateCustomerDto })
  @IsOptional()
  customer?: UserAdminUpdateCustomerDto;

  @swagger.ApiPropertyOptional({ type: () => UserAdminUpdateDriverDto })
  @IsOptional()
  driver?: UserAdminUpdateDriverDto;
}

export class UserAdminListQueryDto {
  @swagger.ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @swagger.ApiPropertyOptional({
    enum: ["PRIVATE_CUSTOMER", "BUSINESS_CUSTOMER", "DRIVER", "ADMIN"],
  })
  @IsOptional()
  @IsString()
  roles?: string;

  @swagger.ApiPropertyOptional()
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;

  @swagger.ApiPropertyOptional()
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  hasCustomer?: boolean;

  @swagger.ApiPropertyOptional()
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  hasDriver?: boolean;

  @swagger.ApiPropertyOptional({ enum: ["BUSINESS", "PRIVATE"] })
  @IsOptional()
  @IsString()
  customerType?: string;

  @swagger.ApiPropertyOptional({ enum: ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"] })
  @IsOptional()
  @IsString()
  customerApprovalStatus?: string;

  @swagger.ApiPropertyOptional({ enum: ["PENDING", "APPROVED", "SUSPENDED"] })
  @IsOptional()
  @IsString()
  driverStatus?: string;

  @swagger.ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @swagger.ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @swagger.ApiPropertyOptional({
    enum: ["createdAt", "updatedAt", "email", "username", "fullName", "lastLoginAt"],
    default: "createdAt",
  })
  @IsOptional()
  @IsString()
  @IsIn(["createdAt", "updatedAt", "email", "username", "fullName", "lastLoginAt"])
  sortBy?: string = "createdAt";

  @swagger.ApiPropertyOptional({ enum: ["asc", "desc"], default: "desc" })
  @IsOptional()
  @IsString()
  @IsIn(["asc", "desc"])
  sortOrder?: "asc" | "desc" = "desc";

  @swagger.ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Transform(toNumberOrDefault(1))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @swagger.ApiPropertyOptional({ default: 25 })
  @IsOptional()
  @Transform(toNumberOrDefault(25))
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number = 25;
}

export class UserAdminActionDto {
  @swagger.ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @swagger.ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actorUserId?: string | null;
}
export class UserAdminApprovalActionDto {
  @swagger.ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actorUserId?: string | null;

  @swagger.ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string | null;

  @swagger.ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string | null;

  @swagger.ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  postpaidEnabled?: boolean;
}

export class UserAdminCreateBodyDto {
  @swagger.ApiProperty()
  email!: string;

  @swagger.ApiProperty()
  username!: string;

  @swagger.ApiProperty()
  password!: string;

  @swagger.ApiPropertyOptional()
  fullName?: string | null;

  @swagger.ApiPropertyOptional()
  phone?: string | null;

  @swagger.ApiPropertyOptional()
  isActive?: boolean;

  @swagger.ApiPropertyOptional()
  actorUserId?: string | null;
}

/**
 * Body for POST /api/users/admin-invite.
 * The admin only supplies identity fields — NO password. The invitee
 * receives a single-use setup link by email and sets their own password.
 */
export class UserAdminInviteBodyDto {
  @swagger.ApiProperty()
  @IsEmail({}, { message: "A valid email address is required" })
  email!: string;

  @swagger.ApiProperty()
  @IsString()
  fullName!: string;

  @swagger.ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string | null;

  @swagger.ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actorUserId?: string | null;
}

/**
 * Body for POST /api/auth/accept-invite (public).
 * Exchanges a single-use invite token for a password set by the invitee.
 */
export class AdminInviteAcceptDto {
  @swagger.ApiProperty()
  @IsString()
  token!: string;

  @swagger.ApiProperty()
  @IsString()
  password!: string;
}

/**
 * Body for POST /api/users/:id/admin-disable.
 * Disabling flips User.isActive to false and stamps disabledAt/disabledReason.
 * The JWT strategy re-reads the user from the DB on EVERY request, so the
 * disabled admin's existing sessions stop working immediately, and the
 * login flow rejects them on the next sign-in attempt. The reason is
 * recorded in the admin audit log.
 */
export class UserAdminDisableBodyDto {
  @swagger.ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string | null;

  @swagger.ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actorUserId?: string | null;
}

/**
 * Body for POST /api/users/:id/admin-enable.
 * Re-enables a previously disabled administrator: clears the disabled
 * stamps and flips isActive back to true. The admin signs in again with
 * their existing password — nothing is reset.
 */
export class UserAdminEnableBodyDto {
  @swagger.ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actorUserId?: string | null;
}