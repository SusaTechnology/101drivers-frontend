// import { Body, Controller, Post } from "@nestjs/common";
// import { EmailVerificationService } from "./email-verification.service";
// import { RequestEmailVerificationBody } from "./dto/requestEmailVerification.dto";
// import { VerifyEmailBody } from "./dto/verifyEmail.dto";

// @Controller("auth")
// export class EmailVerificationController {
//   constructor(private service: EmailVerificationService) {}

//   @Post("request-email-verification")
//   async requestEmailVerification(
//     @Body() body: RequestEmailVerificationBody
//   ) {
//     return this.service.requestVerification(body.email, body.fullName);
//   }

//   @Post("verify-email")
//   async verifyEmail(@Body() body: VerifyEmailBody) {
//     return this.service.verifyEmail(body.token);
//   }
// }