import { IsEmail, IsString, Matches, MinLength } from "class-validator";

export class ResetPasswordDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Matches(/^\d{6}$/, {
    message: "verificationToken must be a valid 6-digit OTP",
  })
  verificationToken!: string;

  @IsString()
  @MinLength(6)
  newPassword!: string;
}