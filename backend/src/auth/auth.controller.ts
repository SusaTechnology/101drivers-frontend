import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
} from "@nestjs/common";
import { Request, Response } from "express";
import { ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { Credentials } from "./Credentials";
import { UserInfo } from "./UserInfo";
import { SignupDriverDto } from "./dto/SignupDriver.dto";
import { SignupCustomerDto } from "./dto/SignupCustomer.dto";
import { JwtAuthGuard } from "./jwt/jwtAuth.guard";
import { ForgotPasswordDto } from "./dto/ForgotPassword.dto";
import { ResetPasswordDto } from "./dto/ResetPassword.dto";
@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: Credentials,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ): Promise<UserInfo> {
    return this.authService.login(body, request, response);
  }

  @Get("refresh-token")
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ): Promise<UserInfo> {
    return this.authService.refreshToken(request, response);
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ): Promise<{ success: boolean; message: string }> {
    return this.authService.logout(request, response);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  async me(@Req() request: Request) {
    return request.user;
  }

  @Post("signup/driver")
  @HttpCode(HttpStatus.OK)
  async signupDriver(
    @Body() body: SignupDriverDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ): Promise<any> {
    return this.authService.signupDriver(body, request, response);
  }

  @Post("signup/customer/private")
  @HttpCode(HttpStatus.OK)
  async signupPrivateCustomer(
    @Body() body: SignupCustomerDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ): Promise<any> {
    return this.authService.signupPrivateCustomer(body, request, response);
  }

  @Post("signup/customer/business")
  @HttpCode(HttpStatus.OK)
  async signupBusinessCustomer(
    @Body() body: SignupCustomerDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ): Promise<any> {
    return this.authService.signupBusinessCustomer(body, request, response);
  }
  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() body: ForgotPasswordDto
  ): Promise<{ success: boolean; message: string }> {
    return this.authService.forgotPassword(body);
  }

  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() body: ResetPasswordDto
  ): Promise<{ success: boolean; message: string }> {
    return this.authService.resetPassword(body);
  }
}