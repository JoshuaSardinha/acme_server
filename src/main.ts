import { ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
// Using standard ValidationPipe instead of Express-compatible one

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors();

  // Global exception filter (must be applied before interceptors)
  const reflector = app.get(Reflector);
  app.useGlobalFilters(new AllExceptionsFilter(reflector));

  // Global response interceptor
  app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));

  // Global validation pipe (standard NestJS)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  // Swagger documentation setup
  const config = new DocumentBuilder()
    .setTitle('Acme API')
    .setDescription('Backend API for Acme Application')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Server running on port ${port}`);
}

bootstrap();
