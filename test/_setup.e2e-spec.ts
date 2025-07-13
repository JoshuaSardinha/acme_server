import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';
import { createTestingModule } from './utils/e2e-setup.helper';

describe('E2E Environment Setup (Canary Test)', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let sequelize: Sequelize;

  it('should connect to test database successfully', async () => {
    const result = await createTestingModule();
    app = result.app;
    moduleFixture = result.moduleFixture;
    sequelize = result.sequelize;

    await expect(sequelize.authenticate()).resolves.toBeUndefined();

    await app.close();
  });
});
