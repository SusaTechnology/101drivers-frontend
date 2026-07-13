import { IsString } from "class-validator";

export class VerifyEmailBody {
  @IsString()
  token!: string;
}