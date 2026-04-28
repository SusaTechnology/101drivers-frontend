import { ValidationPipe } from "@nestjs/common";
import { HttpAdapterHost, NestFactory } from "@nestjs/core";
import { OpenAPIObject, SwaggerModule } from "@nestjs/swagger";
import { HttpExceptionFilter } from "./filters/HttpExceptions.filter";
import { AppModule } from "./app.module";
import { connectMicroservices } from "./connectMicroservices";
import {
  swaggerPath,
  swaggerDocumentOptions,
  swaggerSetupOptions,
} from "./swagger";
import { configureCors } from "./common/cors-cookie.util";

const { PORT = 6000 } = process.env;

async function main() {
  const app = await NestFactory.create(AppModule);
  configureCors(app);

  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      forbidUnknownValues: false,
    })
  );

  const document = SwaggerModule.createDocument(app, swaggerDocumentOptions);

  Object.values((document as OpenAPIObject).paths).forEach((path: any) => {
    Object.values(path).forEach((method: any) => {
      if (Array.isArray(method.security) && method.security.includes("isPublic")) {
        method.security = [];
      }
    });
  });

  await connectMicroservices(app);
  await app.startAllMicroservices();

  SwaggerModule.setup(swaggerPath, app, document, swaggerSetupOptions);

  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new HttpExceptionFilter(httpAdapter));

  await app.listen(Number(PORT));

  const baseUrl = await app.getUrl(); // e.g. http://localhost:6000
  console.log(`🚀 101 Drivers running on port ${PORT}`);
  // console.log(`🌐 Base URL: ${baseUrl}`);
  // console.log(`📘 Swagger: ${baseUrl}${swaggerPath}`);
  // console.log(`🔌 API Prefix: ${baseUrl}/api`);

  return app;
}

module.exports = main();
