import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';
import * as request from 'supertest';

// Core modules and guards
import { AppModule } from '../../src/app.module';
import { ClientVersionGuard } from '../../src/core/guards/client-version.guard';
import { JwtAuthGuard } from '../../src/core/guards/jwt-auth.guard';

// Test utilities
import { authHelper } from '../auth/auth.helper';
import { MockJwtAuthGuard } from '../auth/mock-jwt-auth.guard';
import { ensureAcmeCompanyExists, getAcmeCompanyId } from '../factories/acme-company.factory';
import { createTestCompany } from '../factories/company.factory';
import { createStandardRoles, getRoleByCode } from '../factories/role.factory';
import { createTestUser } from '../factories/user.factory';
import { DbCleanerService } from '../utils/db-cleaner.service';

// Entities
import { User } from '../../src/modules/auth/entities/user.entity';
import { Company } from '../../src/modules/company/entities/company.entity';

describe('CompanyController (e2e)', () => {
  let app: INestApplication;
  let sequelize: Sequelize;
  let dbCleaner: DbCleanerService;

  // Test data
  let testCompany: Company;
  let acmeCompany: Company;
  let vendorAdminUser: User;
  let clientUser: User;
  let acmeAdminUser: User;
  let userWithoutCompany: User;

  // JWT tokens
  let vendorAdminToken: string;
  let clientToken: string;
  let acmeAdminToken: string;
  let noCompanyToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(MockJwtAuthGuard)
      .overrideGuard(ClientVersionGuard)
      .useValue({ canActivate: () => true }) // Bypass client version check for tests
      .compile();

    app = moduleFixture.createNestApplication();

    // Apply same middleware as production
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    );

    await app.init();

    sequelize = app.get<Sequelize>(getConnectionToken());
    dbCleaner = new DbCleanerService(sequelize);
  });

  beforeEach(async () => {
    // Clean database before each test
    await dbCleaner.cleanAll();

    // Create standard roles first
    await createStandardRoles();

    // Ensure Acme company exists
    acmeCompany = await ensureAcmeCompanyExists();

    // Create test company
    testCompany = await createTestCompany({
      name: 'Test Vendor Company',
      subdomain: 'test-vendor',
      subscription_type: 'premium',
      subscription_status: 'active',
    });

    // Update with email after creation since factory doesn't support it
    await testCompany.update({
      email: 'contact@testvendor.com',
    });

    // Create test users with different roles
    const vendorAdminRole = await getRoleByCode('vendor_admin');
    const clientRole = await getRoleByCode('client');
    const acmeAdminRole = await getRoleByCode('acme_admin');

    if (!vendorAdminRole || !clientRole || !acmeAdminRole) {
      throw new Error('Required roles not found');
    }

    vendorAdminUser = await createTestUser(testCompany.id, {
      email: 'vendor.admin@testcompany.com',
      first_name: 'Vendor',
      last_name: 'Admin',
      role_id: vendorAdminRole.id,
      auth0_user_id: 'auth0|vendor_admin_test',
    });

    clientUser = await createTestUser(testCompany.id, {
      email: 'client@testcompany.com',
      first_name: 'Client',
      last_name: 'User',
      role_id: clientRole.id,
      auth0_user_id: 'auth0|client_test',
    });

    acmeAdminUser = await User.create({
      first_name: 'AC',
      last_name: 'Admin',
      email: 'ac.admin@acme.com',
      auth0_user_id: 'auth0|ac_admin_test',
      role_id: acmeAdminRole.id,
      company_id: getAcmeCompanyId(),
    });

    // Create user without company
    userWithoutCompany = await User.create({
      first_name: 'No',
      last_name: 'Company',
      email: 'nocompany@example.com',
      auth0_user_id: 'auth0|no_company_test',
      role_id: vendorAdminRole.id,
      company_id: null, // No company assigned
    });

    // Generate JWT tokens
    vendorAdminToken = authHelper.generateToken({
      sub: vendorAdminUser.auth0_user_id,
      email: vendorAdminUser.email,
      role: 'vendor_admin',
      org_id: vendorAdminUser.company_id,
    });

    clientToken = authHelper.generateToken({
      sub: clientUser.auth0_user_id,
      email: clientUser.email,
      role: 'client',
      org_id: clientUser.company_id,
    });

    acmeAdminToken = authHelper.generateToken({
      sub: acmeAdminUser.auth0_user_id,
      email: acmeAdminUser.email,
      role: 'acme_admin',
      org_id: acmeAdminUser.company_id,
    });

    noCompanyToken = authHelper.generateToken({
      sub: userWithoutCompany.auth0_user_id,
      email: userWithoutCompany.email,
      role: 'vendor_admin',
      // org_id intentionally omitted - user has no company
    });
  });

  afterAll(async () => {
    await dbCleaner.cleanAll();
    await app.close();
  });

  describe('GET /company', () => {
    it('should return 401 when not authenticated', async () => {
      await request(app.getHttpServer()).get('/company').expect(401);
    });

    it('should return company info for authenticated vendor admin user', async () => {
      const response = await request(app.getHttpServer())
        .get('/company')
        .set('Authorization', `Bearer ${vendorAdminToken}`)
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({
          id: testCompany.id,
          name: testCompany.name,
          email: testCompany.email,
          type: testCompany.type,
          status: testCompany.status,
          subdomain: testCompany.subdomain,
        })
      );
    });

    it('should return company info for Acme admin user', async () => {
      const response = await request(app.getHttpServer())
        .get('/company')
        .set('Authorization', `Bearer ${acmeAdminToken}`)
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({
          id: acmeCompany.id,
          name: acmeCompany.name,
          email: acmeCompany.email,
          type: acmeCompany.type,
          status: acmeCompany.status,
        })
      );
    });

    it('should return 403 for client users', async () => {
      await request(app.getHttpServer())
        .get('/company')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(403);
    });

    it('should return 404 when user has no company', async () => {
      await request(app.getHttpServer())
        .get('/company')
        .set('Authorization', `Bearer ${noCompanyToken}`)
        .expect(404);
    });
  });
});
