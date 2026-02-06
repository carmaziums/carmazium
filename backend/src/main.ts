import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'https://carmazium.vercel.app',
      'https://carmazium.onrender.com'
    ],
    credentials: true,
  });

  // Global validation pipe for DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are present
      transform: true, // Automatically transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Enable implicit type conversion
      },
    }),
  );

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Carmazium API')
    .setDescription('Core Marketplace Engine API for Carmazium')
    .setVersion('1.0')
    .addTag('Listings', 'Vehicle listings management')
    .addBearerAuth() // For future JWT authentication
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT ?? 3001;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📚 Swagger docs available at http://localhost:${port}/api`);
}
bootstrap();
