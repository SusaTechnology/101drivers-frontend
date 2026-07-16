import { IsEmail, IsString, Matches } from "class-validator";

export class VerifyOtpDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Matches(/^\d{6}$/, {
    message: "verificationToken must be a valid 6-digit OTP",
  })
  verificationToken!: string;
}
