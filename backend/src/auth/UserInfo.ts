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
  
}