import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, CanActivate, Type } from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import { getConnectionToken } from '@nestjs/sequelize';

// Import the AppModule which has correct database configuration
import { AppModule } from '../../src/app.module';

// Import test utilities
import { DbCleanerService } from './db-cleaner.service';

// Type for guard overrides
export type GuardOverride = {
  guard: Type<CanActivate>;
  useClass?: Type<any>;
  useValue?: any;
};

export interface TestSetupOptions {
  additionalImports?: any[];
  guardOverrides?: GuardOverride[];
}

export const createTestingModule = async (
  options: TestSetupOptions = {}
): Promise<{
  app: INestApplication;
  moduleFixture: TestingModule;
  sequelize: Sequelize;
  dbCleaner: DbCleanerService;
}> => {
  const { additionalImports = [], guardOverrides = [] } = options;

  // Use AppModule which has the correct database configuration
  const moduleBuilder = Test.createTestingModule({
    imports: [AppModule, ...additionalImports],
  });

  // Apply guard overrides dynamically
  for (const override of guardOverrides) {
    const builder = moduleBuilder.overrideGuard(override.guard);
    if (override.useClass) {
      builder.useClass(override.useClass);
    } else if (override.useValue) {
      builder.useValue(override.useValue);
    }
  }

  const moduleFixture = await moduleBuilder.compile();

  const app = moduleFixture.createNestApplication();

  // Apply global validation pipe like in main app
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  await app.init();

  // Get database connection and create cleaner service
  const sequelize = app.get<Sequelize>(getConnectionToken());
  const dbCleaner = new DbCleanerService(sequelize);

  return { app, moduleFixture, sequelize, dbCleaner };
};
