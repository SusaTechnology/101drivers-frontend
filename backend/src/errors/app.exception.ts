import { HttpException, HttpStatus } from "@nestjs/common";

export class AppException extends HttpException {
  constructor(
    message: string,
    code: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST
  ) {
    super(
      {
        statusCode: status,
        message,
        code,
        timestamp: new Date().toISOString(),
      },
      status
    );
  }
}
