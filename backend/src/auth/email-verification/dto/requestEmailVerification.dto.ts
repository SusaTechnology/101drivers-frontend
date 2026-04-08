import { IsEmail, IsOptional, IsString } from "class-validator";

export class RequestEmailVerificationBody {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  fullName?: string;
}