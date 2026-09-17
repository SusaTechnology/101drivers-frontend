import { Field, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class UserInfo {
  @Field(() => String)
  id!: string;

  @Field(() => String, { nullable: true })
  profileId?: string | null;

  @Field(() => String)
  username!: string;

  @Field(() => String, { nullable: true })
  email?: string | null;

  @Field(() => [String])
  roles!: string[];

  @Field(() => String, { nullable: true })
  accessToken?: string;

  @Field(() => String, { nullable: true })
  refreshToken?: string;

  @Field(() => String, { nullable: true })
  fullName?: string | null;

  @Field(() => Boolean, { nullable: true })
  onboardingCompleted?: boolean;

  @Field(() => String, { nullable: true })
  onboardingToken?: string | null;

  @Field(() => String, { nullable: true })
  customerApprovalStatus?: string | null;

  @Field(() => String, { nullable: true })
  driverStatus?: string | null;

  /**
   * Elevated-admin flag (ADMIN rows only; falsy for everyone else).
   * Populated fresh from the DB on every request by the JWT strategy,
   * so grant/revoke takes effect immediately. Drives which admin
   * actions the Users page offers (see src/auth/super-admin.ts).
   */
  @Field(() => Boolean, { nullable: true })
  isSuperAdmin?: boolean;
}