import * as common from "@nestjs/common";
import { Args, Context, Mutation, Query, Resolver } from "@nestjs/graphql";
import { Request, Response } from "express";
import * as gqlACGuard from "../auth/gqlAC.guard";
import { AuthService } from "./auth.service";
import { GqlDefaultAuthGuard } from "./gqlDefaultAuth.guard";
import { UserData } from "./userData.decorator";
import { LoginArgs } from "./LoginArgs";
import { UserInfo } from "./UserInfo";

@Resolver(() => UserInfo)
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation(() => UserInfo)
  async login(
    @Args() args: LoginArgs,
    @Context() ctx: { req: Request; res: Response }
  ): Promise<UserInfo> {
    return this.authService.login(args.credentials, ctx.req, ctx.res);
  }

  @Query(() => UserInfo)
  @common.UseGuards(GqlDefaultAuthGuard, gqlACGuard.GqlACGuard)
  async userInfo(@UserData() entityInfo: UserInfo): Promise<UserInfo> {
    return entityInfo;
  }
}