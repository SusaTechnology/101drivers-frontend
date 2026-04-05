import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from "@nestjs/common";
import { Response } from "express";

@Catch(HttpException)
export class AppExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status = exception.getStatus();
    const error = exception.getResponse();

    response.status(status).json(
      typeof error === "string"
        ? {
            statusCode: status,
            message: error,
            timestamp: new Date().toISOString(),
          }
        : error
    );
  }
}
 