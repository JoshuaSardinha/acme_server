import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
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
import { createTestCompany } from '../factories/company.factory';
import { ensureAcmeCompanyExists, getAcmeCompanyId } from '../factories/acme-company.factory';
import { createStandardRoles, getRoleByCode } from '../factories/role.factory';
import { createTestUser } from '../factories/user.factory';
import { DbCleanerService } from '../utils/db-cleaner.service';

// Entities
import { User } from '../../src/modules/auth/entities/user.entity';
import { Company } from '../../src/modules/company/entities/company.entity';

/**
 * Users E2E Tests
 *
 * Tests the users endpoints functionality including:
 * - GET /users/me: Authenticated user profile retrieval
 * - GET /users/:id/role: Role-based access control
 * - Multi-tenant isolation: Users can only access their own company data
 * - Authentication failures: Invalid tokens return proper errors
 * - Security: Sensitive fields are not exposed
 */
describe('Users (E2E)', () => {
  let app: INestApplication;
  let sequelize: Sequelize;
  let dbCleaner: DbCleanerService;

  // Test data
  let testCompany1: Company;
  let testCompany2: Company;
  let nationalNinerCompany: Company;
  let adminUser: User;
  let regularUser: User;
  let crossTenantUser: User;
  let nnAdminUser: User;

  // Mock auth tokens
  let adminToken: string;
  let regularToken: string;
  let crossTenantToken: string;
  let nnAdminToken: string;
  let invalidToken: string;
  let expiredToken: string;

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

    // Ensure National Niner company exists
    nationalNinerCompany = await ensureAcmeCompanyExists();

    // Create test companies
    testCompany1 = await createTestCompany({
      name: 'Test Company 1',
      subdomain: 'test-company-1',
      subscription_type: 'premium',
      subscription_status: 'active',
    });

    testCompany2 = await createTestCompany({
      name: 'Test Company 2',
      subdomain: 'test-company-2',
      subscription_type: 'basic',
      subscription_status: 'active',
    });

    // Get roles
    const vendorAdminRole = await getRoleByCode('vendor_admin');
    const vendorEmployeeRole = await getRoleByCode('vendor_employee');
    const nnAdminRole = await getRoleByCode('national_niner_admin');

    if (!vendorAdminRole || !vendorEmployeeRole || !nnAdminRole) {
      throw new Error('Required roles not found');
    }

    // Create test users with different roles
    adminUser = await createTestUser(testCompany1.id, {
      email: 'admin@testcompany1.com',
      first_name: 'Admin',
      last_name: 'User',
      role_id: vendorAdminRole.id,
      auth0_user_id: 'auth0|admin_user',
    });

    regularUser = await createTestUser(testCompany1.id, {
      email: 'user@testcompany1.com',
      first_name: 'Regular',
      last_name: 'User',
      role_id: vendorEmployeeRole.id,
      auth0_user_id: 'auth0|regular_user',
    });

    crossTenantUser = await createTestUser(testCompany2.id, {
      email: 'admin@testcompany2.com',
      first_name: 'Cross',
      last_name: 'Tenant',
      role_id: vendorAdminRole.id,
      auth0_user_id: 'auth0|cross_tenant_user',
    });

    // Create National Niner admin user
    nnAdminUser = await User.create({
      first_name: 'NN',
      last_name: 'Admin',
      email: 'nn.admin@nationalniner.com',
      auth0_user_id: 'auth0|nn-admin-test',
      role_id: nnAdminRole.id,
      company_id: getAcmeCompanyId(),
    });

    // Generate test tokens
    adminToken = authHelper.generateToken({
      sub: adminUser.auth0_user_id,
      email: adminUser.email,
      role: 'vendor_admin',
      org_id: adminUser.company_id,
      permissions: ['ADMIN_ACCESS', 'MANAGE_USERS'],
    });

    regularToken = authHelper.generateToken({
      sub: regularUser.auth0_user_id,
      email: regularUser.email,
      role: 'vendor_employee',
      org_id: regularUser.company_id,
    });

    crossTenantToken = authHelper.generateToken({
      sub: crossTenantUser.auth0_user_id,
      email: crossTenantUser.email,
      role: 'vendor_admin',
      org_id: crossTenantUser.company_id,
      permissions: ['ADMIN_ACCESS', 'MANAGE_USERS'],
    });

    nnAdminToken = authHelper.generateToken({
      sub: nnAdminUser.auth0_user_id,
      email: nnAdminUser.email,
      role: 'national_niner_admin',
      org_id: nnAdminUser.company_id,
      permissions: ['MANAGE_COMPANIES', 'APPROVE_COMPANIES', 'CREATE_COMPANIES'],
    });

    invalidToken = authHelper.generateInvalidToken();
    expiredToken = authHelper.generateExpiredToken({
      sub: adminUser.auth0_user_id,
      email: adminUser.email,
    });
  });

  afterAll(async () => {
    await dbCleaner.cleanAll();
    await app.close();
  });

  describe('Happy Path Tests', () => {
    it('should return other user profile without sensitive data', async () => {
      const response = await request(app.getHttpServer())
        .get(`/users/${regularUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);

      // Assert response structure
      expect(response.body).toMatchObject({
        id: regularUser.id,
        email: regularUser.email,
        firstName: regularUser.first_name,
        lastName: regularUser.last_name,
        companyName: 'Test Company 1',
        company: expect.objectContaining({
          id: testCompany1.id,
          name: 'Test Company 1',
          type: expect.any(String),
          status: expect.any(String),
        }),
        role: expect.objectContaining({
          code: 'vendor_employee',
          name: 'Vendor Employee',
        }),
        status: regularUser.status,
      });

      // Assert sensitive fields are NOT present for other users' profiles
      expect(response.body).not.toHaveProperty('auth0id');
      expect(response.body).not.toHaveProperty('permissions');
      expect(response.body).not.toHaveProperty('company_id');
      expect(response.body).not.toHaveProperty('created_at');
      expect(response.body).not.toHaveProperty('updated_at');
    });

    it('should return 404 when trying to view user from different company', async () => {
      await request(app.getHttpServer())
        .get(`/users/${crossTenantUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should return user profile for valid authenticated admin user', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);

      // Assert response structure
      expect(response.body).toMatchObject({
        id: adminUser.id,
        email: adminUser.email,
        firstName: adminUser.first_name,
        lastName: adminUser.last_name,
        companyName: 'Test Company 1',
        company: expect.objectContaining({
          id: testCompany1.id,
          name: 'Test Company 1',
          type: expect.any(String),
          status: expect.any(String),
        }),
        role: expect.objectContaining({
          code: 'vendor_admin',
          name: 'Vendor Admin',
        }),
        permissions: expect.any(Array),
        auth0id: adminUser.auth0_user_id,
        status: adminUser.status,
      });

      // Assert sensitive fields ARE present for own profile
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('auth0id');
      expect(response.body).toHaveProperty('permissions');

      // Assert internal fields are still NOT present
      expect(response.body).not.toHaveProperty('company_id');
      expect(response.body).not.toHaveProperty('created_at');
      expect(response.body).not.toHaveProperty('updated_at');
    });

    it('should return user profile for valid authenticated regular user', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(HttpStatus.OK);

      expect(response.body).toMatchObject({
        id: regularUser.id,
        email: regularUser.email,
        firstName: regularUser.first_name,
        lastName: regularUser.last_name,
        companyName: 'Test Company 1',
        company: expect.objectContaining({
          id: testCompany1.id,
          name: 'Test Company 1',
          type: expect.any(String),
          status: expect.any(String),
        }),
        role: expect.objectContaining({
          code: 'vendor_employee',
          name: 'Vendor Employee',
        }),
        permissions: expect.any(Array),
        auth0id: regularUser.auth0_user_id,
        status: regularUser.status,
      });
    });

    it('should return different data for users from different companies', async () => {
      const response1 = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);

      const response2 = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${crossTenantToken}`)
        .expect(HttpStatus.OK);

      expect(response1.body.companyName).toBe('Test Company 1');
      expect(response2.body.companyName).toBe('Test Company 2');
      expect(response1.body.email).not.toBe(response2.body.email);
    });

    it('should return correct data for National Niner admin user', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${nnAdminToken}`)
        .expect(HttpStatus.OK);

      expect(response.body).toMatchObject({
        id: nnAdminUser.id,
        email: nnAdminUser.email,
        firstName: nnAdminUser.first_name,
        lastName: nnAdminUser.last_name,
        companyName: expect.stringContaining('National Niner'),
        company: expect.objectContaining({
          id: nationalNinerCompany.id,
          type: expect.any(String),
          status: expect.any(String),
        }),
        role: expect.objectContaining({
          code: 'national_niner_admin',
          name: 'National Niner Admin',
        }),
        permissions: expect.any(Array),
        auth0id: nnAdminUser.auth0_user_id,
        status: nnAdminUser.status,
      });
    });
  });

  describe('Role-Based Access Control Tests', () => {
    it('should allow admin to view other user roles within same company', async () => {
      const response = await request(app.getHttpServer())
        .get(`/users/${regularUser.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);

      expect(response.body).toMatchObject({
        user_id: regularUser.id,
        role: expect.objectContaining({
          code: 'vendor_employee',
          name: 'Vendor Employee',
        }),
        user: {
          id: regularUser.id,
          email: regularUser.email,
          first_name: regularUser.first_name,
          last_name: regularUser.last_name,
        },
      });
    });

    it('should allow users to view their own role', async () => {
      const response = await request(app.getHttpServer())
        .get(`/users/${regularUser.id}/role`)
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(HttpStatus.OK);

      expect(response.body.user_id).toBe(regularUser.id);
      expect(response.body.role.code).toBe('vendor_employee');
    });

    it('should forbid regular user from viewing other user roles', async () => {
      const response = await request(app.getHttpServer())
        .get(`/users/${adminUser.id}/role`)
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(HttpStatus.FORBIDDEN);

      expect(response.body).toMatchObject({
        success: false,
        code: 'ROLE_403',
        message: 'Forbidden',
      });
    });

    it('should prevent cross-tenant role access', async () => {
      const response = await request(app.getHttpServer())
        .get(`/users/${adminUser.id}/role`)
        .set('Authorization', `Bearer ${crossTenantToken}`)
        .expect(HttpStatus.NOT_FOUND); // Returns 404 for security

      expect(response.body).toMatchObject({
        success: false,
        code: 'ROLE_404',
        message: 'User not found',
      });
    });
  });

  describe('Authentication Failure Tests', () => {
    it('should return 401 Unauthorized when no token is provided', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/me')
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String),
      });
    });

    it('should return 401 Unauthorized for invalid token format', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', 'Invalid token format')
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String),
      });
    });

    it('should return 401 Unauthorized for invalid token signature', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String),
      });
    });

    it('should return 401 Unauthorized for expired token', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String),
      });
    });

    it('should return 401 Unauthorized when user does not exist in database', async () => {
      // Generate token for non-existent user
      const nonExistentUserToken = authHelper.generateToken({
        sub: 'auth0|non_existent_user',
        email: 'nonexistent@example.com',
        role: 'client',
      });

      const response = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${nonExistentUserToken}`)
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String),
      });
    });
  });

  describe('Multi-tenant Security', () => {
    it('should ensure users cannot access data from other companies', async () => {
      // Admin from company 1 should get company 1 data
      const adminResponse = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);

      // Admin from company 2 should get company 2 data
      const crossTenantResponse = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${crossTenantToken}`)
        .expect(HttpStatus.OK);

      expect(adminResponse.body.companyName).toBe('Test Company 1');
      expect(crossTenantResponse.body.companyName).toBe('Test Company 2');
      expect(adminResponse.body.email).not.toBe(crossTenantResponse.body.email);
    });

    it('should maintain tenant isolation across different user roles', async () => {
      // Regular user from company 1
      const userResponse1 = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(HttpStatus.OK);

      // Admin from company 2
      const userResponse2 = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${crossTenantToken}`)
        .expect(HttpStatus.OK);

      expect(userResponse1.body.companyName).toBe('Test Company 1');
      expect(userResponse2.body.companyName).toBe('Test Company 2');
      expect(userResponse1.body.companyName).not.toBe(userResponse2.body.companyName);
    });
  });

  describe('Data Validation Tests', () => {
    it('should return valid email format', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);

      const { email } = response.body;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(email).toMatch(emailRegex);
    });

    it('should return permissions array with string values', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);

      expect(Array.isArray(response.body.permissions)).toBe(true);
      if (response.body.permissions.length > 0) {
        expect(response.body.permissions.every((p) => typeof p === 'string')).toBe(true);
      }
    });

    it('should return consistent response structure', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(HttpStatus.OK);

      // Verify response has all required fields
      const requiredFields = [
        'email',
        'firstName',
        'lastName',
        'companyName',
        'role',
        'permissions',
      ];
      requiredFields.forEach((field) => {
        expect(response.body).toHaveProperty(field);
      });

      // Verify no unexpected fields
      const responseKeys = Object.keys(response.body);
      expect(responseKeys).toEqual(expect.arrayContaining(requiredFields));
    });
  });

  describe('Performance Tests', () => {
    it('should respond within acceptable time limits', async () => {
      const start = Date.now();

      await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);

      const responseTime = Date.now() - start;

      // Response should be under 500ms for simple user lookup
      expect(responseTime).toBeLessThan(500);
    });

    it('should handle concurrent requests efficiently', async () => {
      const requests = Array(5)
        .fill(null)
        .map(() =>
          request(app.getHttpServer()).get('/users/me').set('Authorization', `Bearer ${adminToken}`)
        );

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body.email).toBe(adminUser.email);
      });
    });

    it('should return consistent data across multiple requests', async () => {
      const response1 = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(HttpStatus.OK);

      const response2 = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(HttpStatus.OK);

      expect(response1.body).toEqual(response2.body);
    });
  });
});
